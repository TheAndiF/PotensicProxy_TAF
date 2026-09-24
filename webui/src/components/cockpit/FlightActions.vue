<template>
  <div class="actions-container">
    <div class="panel-title">✈️ 飞行快捷动作</div>
    <div class="btn-grid">
      <button class="btn btn-green" @click="DroneControlService.takeoff()">🛫 一键起飞</button>
      <button class="btn" @click="DroneControlService.land()">🛬 自动降落</button>
      <button class="btn" @click="DroneControlService.rth()">🏠 一键返航</button>
      <button class="btn btn-red" @click="DroneControlService.emergencyStop()">⛔ 紧急急停</button>
    </div>

    <div class="panel-title" style="margin-top: 10px;">📷 相机与图传控制</div>
    <div class="btn-grid">
      <button class="btn" @click="DroneControlService.takePhoto()">📸 拍照</button>
      <button class="btn" @click="DroneControlService.toggleRecord()">🎥 录像开关</button>
      <button class="btn btn-cyan" @click="DroneControlService.requestIdr()">🔄 请求关键帧 (IDR)</button>
      <button class="btn" @click="DroneControlService.initLiveView()">📡 图传参数初始化</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DroneControlService } from '../../services/DroneControlService'
</script>

<style scoped>
.actions-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--cyan);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.btn {
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border);
  background: #192033;
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s ease;
  font-family: inherit;
}

.btn:hover {
  background: #232c45;
  border-color: #3b4872;
}

.btn:active {
  transform: translateY(1px);
}

.btn-green {
  background: rgba(0, 255, 136, 0.15);
  border-color: var(--accent);
  color: var(--accent);
}

.btn-green:hover {
  background: rgba(0, 255, 136, 0.3);
}

.btn-red {
  background: rgba(255, 42, 95, 0.2);
  border-color: var(--danger);
  color: var(--danger);
  font-weight: 800;
}

.btn-red:hover {
  background: rgba(255, 42, 95, 0.4);
}

.btn-cyan {
  background: rgba(0, 217, 255, 0.15);
  border-color: var(--cyan);
  color: var(--cyan);
}

.btn-cyan:hover {
  background: rgba(0, 217, 255, 0.3);
}
</style>
