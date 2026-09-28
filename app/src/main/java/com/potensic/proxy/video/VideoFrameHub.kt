package com.potensic.proxy.video

import com.potensic.proxy.VideoExtractor
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * Fan-out boundary for extracted video NAL units.
 * The extractor has one authoritative queue; the service consumes it once and publishes
 * to independent subscribers so native decoding and browser streaming cannot steal frames
 * from each other.
 */
class VideoFrameHub(private val maxQueuedPerSubscriber: Int = 120) {
    private val subscribers = ConcurrentHashMap<String, ConcurrentLinkedQueue<VideoExtractor.NalUnit>>()

    class Subscription internal constructor(
        private val id: String,
        private val owner: VideoFrameHub,
        internal val queue: ConcurrentLinkedQueue<VideoExtractor.NalUnit>,
    ) : AutoCloseable {
        fun poll(): VideoExtractor.NalUnit? = queue.poll()
        override fun close() { owner.unsubscribe(id) }
    }

    fun subscribe(): Subscription {
        val id = UUID.randomUUID().toString()
        val queue = ConcurrentLinkedQueue<VideoExtractor.NalUnit>()
        subscribers[id] = queue
        return Subscription(id, this, queue)
    }

    fun publish(nal: VideoExtractor.NalUnit) {
        subscribers.values.forEach { queue ->
            while (queue.size >= maxQueuedPerSubscriber) queue.poll()
            queue.offer(nal)
        }
    }

    fun subscriberCount(): Int = subscribers.size
    private fun unsubscribe(id: String) { subscribers.remove(id) }
    fun clear() { subscribers.values.forEach { it.clear() } }
}
