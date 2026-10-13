package com.potensic.proxy

import android.graphics.BitmapFactory
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.util.Base64
import java.io.ByteArrayOutputStream
import org.json.JSONArray
import org.json.JSONObject
import org.opencv.android.Utils
import org.opencv.android.OpenCVLoader
import org.opencv.core.*
import org.opencv.imgproc.Imgproc
import java.util.ArrayList

/** Offline, read-only marker extraction. No access to drone control paths. */
object PStartOpenCvAnalyzer {
    @Volatile private var ready = false
    @Volatile private var lastError: String? = null

    @Synchronized fun selfTest(): JSONObject {
        try {
            if (!ready) {
                check(OpenCVLoader.initLocal()) { "OpenCVLoader.initLocal() returned false" }
                val probe = Mat.eye(2, 2, CvType.CV_8UC1)
                try { check(Core.countNonZero(probe) == 2) { "OpenCV native matrix test failed" } }
                finally { probe.release() }
                ready = true
            }
            lastError = null
            return JSONObject().put("ready", true).put("engine", "OpenCV Android 4.10.0")
        } catch (e: Throwable) {
            lastError = "${e.javaClass.simpleName}: ${e.message ?: "unknown native failure"}"
            return JSONObject().put("ready", false).put("error", lastError)
        }
    }

    fun inspect(jpeg: ByteArray): JSONObject {
        val state = selfTest()
        check(state.optBoolean("ready")) { "OpenCV initialization failed: ${state.optString("error")}" }

        require(jpeg.size <= 25 * 1024 * 1024) { "JPEG exceeds 25 MiB analysis limit" }
        val bmp = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size)
            ?: throw IllegalArgumentException("Invalid JPEG")
        val src = Mat(); val gray = Mat(); val blur = Mat(); val binary = Mat(); val edges = Mat()
        try {
            Utils.bitmapToMat(bmp, src)
            Imgproc.cvtColor(src, gray, Imgproc.COLOR_RGBA2GRAY)
            // Downscale only for detection: output corners are mapped back to original pixels.
            val scale = minOf(1.0, 1400.0 / maxOf(src.cols(), src.rows()))
            val work = Mat()
            try {
                if (scale < 1) Imgproc.resize(gray, work, Size(), scale, scale, Imgproc.INTER_AREA)
                else gray.copyTo(work)
                Imgproc.GaussianBlur(work, blur, Size(5.0, 5.0), 0.0)
                Imgproc.Canny(blur, edges, 65.0, 160.0)
                val contours = ArrayList<MatOfPoint>(); val hierarchy = Mat()
                try { Imgproc.findContours(edges, contours, hierarchy, Imgproc.RETR_LIST, Imgproc.CHAIN_APPROX_SIMPLE) }
                finally { hierarchy.release() }
                val imageArea = work.cols().toDouble() * work.rows()
                val sampleSize = Size(128.0, 128.0)
                // Small markers may be only ~12px wide at 20m. Do not select by area alone.
                val scored = mutableListOf<Pair<Double, Array<Point>>>()
                var best: Array<Point>? = null
                var bestScore = 0.0
                contours.forEach { c ->
                    val curve = MatOfPoint2f(*c.toArray()); val poly = MatOfPoint2f()
                    try {
                        val perimeter = Imgproc.arcLength(curve, true)
                        Imgproc.approxPolyDP(curve, poly, perimeter * .025, true)
                        val pts = poly.toArray()
                        if (pts.size != 4 || !Imgproc.isContourConvex(MatOfPoint(*pts))) return@forEach
                        val area = kotlin.math.abs(Imgproc.contourArea(poly))
                        if (area < .000045 * imageArea || area > .93 * imageArea) return@forEach
                        val r = Imgproc.boundingRect(MatOfPoint(*pts)); if (r.width < 8 || r.height < 8) return@forEach
                        val ratio = r.width.toDouble() / r.height
                        if (ratio !in .38..2.6) return@forEach
                        // Homography-normalized marker appearance: black inner border and
                        // cross, white quadrants, and asymmetric filled bottom-right corner.
                        val ordered = orderCorners(pts)
                        val srcPoints = MatOfPoint2f(*ordered)
                        val dstPoints = MatOfPoint2f(Point(0.0, 0.0), Point(127.0, 0.0), Point(127.0, 127.0), Point(0.0, 127.0))
                        val transform = Imgproc.getPerspectiveTransform(srcPoints, dstPoints)
                        val patch = Mat()
                        try {
                            Imgproc.warpPerspective(work, patch, transform, sampleSize)
                            val markerScore = scorePatch(patch)
                            // Reject many plausible geometric distractors, rather than rewarding size.
                            if (markerScore >= 0.52) scored.add(markerScore to pts)
                        } finally { patch.release(); transform.release(); srcPoints.release(); dstPoints.release() }
                    } finally { curve.release(); poly.release() }
                }
                val sortedCandidates = scored.sortedByDescending { it.first }
                if (sortedCandidates.isNotEmpty()) {
                    bestScore = sortedCandidates[0].first
                    best = sortedCandidates[0].second
                }
                val output = JSONObject().put("engine", "OpenCV Android 4.10.0")
                    .put("width", src.cols()).put("height", src.rows())
                    .put("verified", false).put("warnings", JSONArray())
                    .put("candidateCount", scored.size)
                val corners = best ?: return output.put("status", "NOT_FOUND")
                    .put("warnings", JSONArray().put("No cross-and-frame-pattern candidate passed minimum score"))
                // Deterministic clockwise order around center; rotate to top-left as start.
                val ordered = orderCorners(corners).toList()
                val normalized = ordered.map { Point(it.x / scale, it.y / scale) }
                val approximateWidthPx = (kotlin.math.hypot(normalized[1].x-normalized[0].x, normalized[1].y-normalized[0].y) + kotlin.math.hypot(normalized[2].x-normalized[3].x, normalized[2].y-normalized[3].y)) / 2.0
                val uncertaintyPx = maxOf(1.0, 800.0 / maxOf(1.0, approximateWidthPx))
                val orientationStatus = "UNVERIFIED" // Rotation cannot be asserted without a validated asymmetric-corner template.

                val destination = arrayOf(Point(0.0, 0.0), Point(800.0, 0.0), Point(800.0, 800.0), Point(0.0, 800.0))
                val sourceMat = MatOfPoint2f(*normalized.toTypedArray()); val destMat = MatOfPoint2f(*destination)
                val matrix = Imgproc.getPerspectiveTransform(sourceMat, destMat)
                try {
                    val inv = matrix.inv(); val center = MatOfPoint2f(Point(400.0, 400.0)); val mapped = MatOfPoint2f()
                    try {
                        Core.perspectiveTransform(center, mapped, inv)
                        val p0 = mapped.toArray()[0]
                        val list = JSONArray(); normalized.forEach { list.put(JSONArray().put(it.x).put(it.y)) }
                        val h = JSONArray(); for (row in 0..2) { val line = JSONArray(); for (col in 0..2) line.put(matrix.get(row,col)[0]); h.put(line) }
                        return output.put("status", "BOUNDARY_CANDIDATE")
                            .put("centerPx", JSONArray().put(p0.x).put(p0.y))
                            .put("patternScore", bestScore)
                            .put("markerWidthPx", approximateWidthPx)
                            .put("approximateCenterUncertaintyPx", uncertaintyPx)
                            .put("orientationStatus", orientationStatus)
                            .put("geometricVerification", "CANDIDATE_ONLY")
                            .put("candidateAmbiguous", sortedCandidates.size > 1 && sortedCandidates[1].first > bestScore - 0.06)
                            .put("outerCornersPx", list).put("homographyImageToMarkerMm", h)
                            .put("warnings", JSONArray().put("Cross/frame appearance tested, but 50-mm geometry, orientation and camera calibration are not independently verified"))
                    } finally { inv.release(); center.release(); mapped.release() }
                } finally { sourceMat.release(); destMat.release(); matrix.release() }
            } finally { work.release() }
        } finally { src.release(); gray.release(); blur.release(); binary.release(); edges.release(); bmp.recycle() }
    }
    /** Build a diagnostic candidate preview, never a verified landing reference. */
    fun normalizedReference(jpeg: ByteArray, marginPercent: Int = 20): JSONObject {
        require(marginPercent in 10..25) { "Margin must be 10..25 percent" }
        val geometry = inspect(jpeg)
        require(geometry.optString("status") == "BOUNDARY_CANDIDATE") { "No complete rectangular marker candidate" }
        val cornerArray = geometry.getJSONArray("outerCornersPx")
        val corners = Array(4) { i ->
            val p = cornerArray.getJSONArray(i)
            Point(p.getDouble(0), p.getDouble(1))
        }
        val bmp = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size)
            ?: throw IllegalArgumentException("Invalid JPEG")
        val rgba = Mat(); val gray = Mat(); val square = Mat(); val enlarged = Mat()
        val source = MatOfPoint2f(*corners)
        val target = MatOfPoint2f(Point(0.0,0.0),Point(399.0,0.0),Point(399.0,399.0),Point(0.0,399.0))
        val transform = Imgproc.getPerspectiveTransform(source, target)
        try {
            Utils.bitmapToMat(bmp, rgba)
            Imgproc.cvtColor(rgba,gray,Imgproc.COLOR_RGBA2GRAY)
            Imgproc.warpPerspective(gray,square,transform,Size(400.0,400.0))
            // Interior corner windows deliberately exclude the common black outer frame.
            val areas = arrayOf(Rect(30,30,80,80),Rect(290,30,80,80),Rect(290,290,80,80),Rect(30,290,80,80))
            val shares = DoubleArray(4)
            val bins = mutableListOf<Double>()
            for (y in 0 until 400 step 5) for (x in 0 until 400 step 5) bins.add(square.get(y,x)[0])
            bins.sort()
            val threshold = (bins[bins.size/5] + bins[bins.size*4/5]) / 2.0
            for (i in 0..3) {
                val a = areas[i]; var dark=0; var count=0
                for (y in a.y until a.y+a.height step 2) for (x in a.x until a.x+a.width step 2) {
                    if (square.get(y,x)[0] < threshold) dark++
                    count++
                }
                shares[i] = dark.toDouble()/count
            }
            val ranked = (0..3).sortedByDescending { shares[it] }
            val separation = shares[ranked[0]]-shares[ranked[1]]
            val orientationClear = separation >= 0.12 && shares[ranked[0]] >= 0.15
            // Rotate from detected dominant corner (TL, TR, BR, BL) to BR index=2.
            // In image coordinates clockwise rotation maps index i -> (i+1)%4.
            val turns = (2-ranked[0]+4)%4
            val marginPx = marginPercent*4
            val size = 400+2*marginPx
            val dest = MatOfPoint2f(
                Point(marginPx.toDouble(),marginPx.toDouble()),
                Point((marginPx+399).toDouble(),marginPx.toDouble()),
                Point((marginPx+399).toDouble(),(marginPx+399).toDouble()),
                Point(marginPx.toDouble(),(marginPx+399).toDouble()))
            val fullTransform = Imgproc.getPerspectiveTransform(source,dest)
            val rotated = Mat()
            try {
                Imgproc.warpPerspective(rgba,enlarged,fullTransform,Size(size.toDouble(),size.toDouble()),Imgproc.INTER_LINEAR,Core.BORDER_CONSTANT,Scalar(0.0,0.0,0.0,0.0))
                when(turns) {
                    0 -> enlarged.copyTo(rotated)
                    1 -> Core.rotate(enlarged,rotated,Core.ROTATE_90_CLOCKWISE)
                    2 -> Core.rotate(enlarged,rotated,Core.ROTATE_180)
                    else -> Core.rotate(enlarged,rotated,Core.ROTATE_90_COUNTERCLOCKWISE)
                }
                val outputBitmap = Bitmap.createBitmap(size,size,Bitmap.Config.ARGB_8888)
                try {
                    Utils.matToBitmap(rotated,outputBitmap)
                    val bytes = ByteArrayOutputStream().use { stream ->
                        check(outputBitmap.compress(Bitmap.CompressFormat.PNG,100,stream)) { "PNG encoding failed" }
                        stream.toByteArray()
                    }
                    val marker = JSONObject().put("sourceCornersPx",geometry.getJSONArray("outerCornersPx"))
                        .put("sourceImageWidth",bmp.width).put("sourceImageHeight",bmp.height)
                        .put("outputWidthPx",size).put("outputHeightPx",size)
                        .put("markerSidePx",400).put("marginPercent",marginPercent)
                        .put("cornerBlackFractions",JSONArray(shares.toList()))
                        .put("cornerThreshold",threshold).put("cornerSeparation",separation)
                        .put("dominantCornerIndex",ranked[0]).put("rotationClockwiseQuarterTurns",turns)
                        .put("orientationStatus",if (orientationClear) "orientation_candidate" else "orientation_ambiguous")
                        .put("geometricVerification","UNVERIFIED")
                        .put("candidateAmbiguous",geometry.optBoolean("candidateAmbiguous"))
                        .put("imageCompleteness","CANDIDATE")
                        .put("pixelValidity","Transparency indicates image areas outside source")
                    val diagnostics = bmp.copy(Bitmap.Config.ARGB_8888, true)
                    try {
                        val canvas = Canvas(diagnostics)
                        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                            color = android.graphics.Color.GREEN; style = Paint.Style.STROKE
                            strokeWidth = maxOf(3f, bmp.width / 350f)
                        }
                        val path = android.graphics.Path().apply {
                            moveTo(corners[0].x.toFloat(), corners[0].y.toFloat())
                            for (i in 1..3) lineTo(corners[i].x.toFloat(), corners[i].y.toFloat())
                            close()
                        }
                        canvas.drawPath(path, paint)
                        paint.color = android.graphics.Color.YELLOW
                        for (corner in corners) canvas.drawCircle(corner.x.toFloat(),corner.y.toFloat(),maxOf(5f,bmp.width/230f),paint)
                        val diagBytes = ByteArrayOutputStream().use { stream ->
                            check(diagnostics.compress(Bitmap.CompressFormat.PNG, 100, stream))
                            stream.toByteArray()
                        }
                        marker.put("diagnosticPngBase64",Base64.encodeToString(diagBytes,Base64.NO_WRAP))
                    } finally { diagnostics.recycle() }
                    return marker.put("pngBase64",Base64.encodeToString(bytes,Base64.NO_WRAP))
                } finally { outputBitmap.recycle() }
            } finally { rotated.release();fullTransform.release();dest.release() }
        } finally {
            transform.release();source.release();target.release()
            rgba.release();gray.release();square.release();enlarged.release();bmp.recycle()
        }
    }

    private fun orderCorners(p: Array<Point>): Array<Point> {
        val tl = p.minBy { it.x + it.y }
        val br = p.maxBy { it.x + it.y }
        val tr = p.maxBy { it.x - it.y }
        val bl = p.minBy { it.x - it.y }
        return arrayOf(tl, tr, br, bl)
    }

    /** Contrast-normalized structural score; intentionally NOT a geometric verification. */
    private fun scorePatch(gray: Mat): Double {
        val lo = MatOfDouble(); val hi = MatOfDouble()
        try {
            Core.meanStdDev(gray, lo, hi)
            if (hi.get(0,0)[0] < 12.0) return 0.0
        } finally { lo.release(); hi.release() }
        val vals = mutableListOf<Int>()
        for (y in 0 until 128 step 4) for (x in 0 until 128 step 4) vals.add(gray.get(y,x)[0].toInt())
        vals.sort()
        val p20 = vals[vals.size / 5]
        val p80 = vals[vals.size * 4 / 5]
        if (p80 - p20 < 35) return 0.0
        val threshold = (p20 + p80) / 2.0
        fun dark(x: Int,y: Int) = if (gray.get(y.coerceIn(0,127),x.coerceIn(0,127))[0] < threshold) 1.0 else 0.0
        fun avg(points: List<Pair<Int,Int>>) = points.map { dark(it.first,it.second) }.average()
        val border = (18..110 step 8).flatMap { listOf(12 to it, 115 to it, it to 12, it to 115) }
        val cross = (43..85 step 6).flatMap { listOf(64 to it, it to 64) }
        val white = listOf(36 to 36, 44 to 44, 84 to 38, 92 to 46, 35 to 86, 44 to 96, 86 to 90)
        val brightCorners = listOf(3 to 3, 124 to 3, 3 to 124)
        return (0.35*avg(border) + 0.32*avg(cross) + 0.22*(1-avg(white)) + 0.11*(1-avg(brightCorners))).coerceIn(0.0,1.0)
    }

}
