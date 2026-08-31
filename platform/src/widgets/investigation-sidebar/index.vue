<template>
  <div class="os-side">
    <div class="os-side-head">
      <strong>Расследования</strong>
      <button class="os-ico-btn" title="Новое расследование" @click="newInvPrompt = true">＋</button>
    </div>

    <div v-if="busy" class="os-side-muted">Загрузка…</div>
    <div v-else-if="investigations.length === 0" class="os-side-muted">Нет расследований</div>

    <div v-else class="os-inv-list">
      <div v-for="inv in investigations" :key="inv.id" class="os-inv">
        <div
          class="os-inv-row"
          :class="{ 'is-open': openInv === inv.id }"
          @click="openInv = openInv === inv.id ? '' : inv.id"
        >
          <span class="os-inv-name">{{ inv.name }}</span>
          <span class="os-inv-count">{{ inv.sketches?.length || 0 }}</span>
        </div>

        <div v-if="openInv === inv.id" class="os-sk-list">
          <button
            v-for="sk in inv.sketches || []"
            :key="sk.id"
            class="os-sk"
            :class="{ 'is-active': activeSketchId === sk.id }"
            @click="$emit('select', inv, sk)"
          >
            <span>▨</span>
            <span class="os-sk-title">{{ sk.title }}</span>
          </button>
          <button class="os-sk os-sk-new" @click="newSketchFor = inv">＋ новый граф</button>
        </div>
      </div>
    </div>

    <div v-if="newInvPrompt" class="os-modal" @click.self="newInvPrompt = false">
      <div class="os-modal-card">
        <h3>Новое расследование</h3>
        <input v-model="newInvName" class="os-input" placeholder="Название" @keyup.enter="createInv" />
        <input v-model="newInvDesc" class="os-input" placeholder="Описание (необязательно)" @keyup.enter="createInv" />
        <div class="os-modal-actions">
          <button class="btn" @click="newInvPrompt = false">Отмена</button>
          <button class="btn" :disabled="!newInvName || invBusy" @click="createInv">Создать</button>
        </div>
      </div>
    </div>

    <div v-if="newSketchFor" class="os-modal" @click.self="cancelSketch">
      <div class="os-modal-card">
        <h3>Новый граф связей</h3>
        <input v-model="newSketchTitle" class="os-input" placeholder="Название графа" @keyup.enter="createSketch" />
        <div class="os-modal-actions">
          <button class="btn" @click="cancelSketch">Отмена</button>
          <button class="btn" :disabled="!newSketchTitle || invBusy" @click="createSketch">Создать</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { investigationApi } from '@/entities/investigation/api'
import { sketchApi } from '@/entities/sketch/api'
import type { Investigation, Sketch } from '@/shared/api/types'

const props = defineProps<{ activeSketchId: string | null }>()

const emit = defineEmits<{
  (e: 'select', inv: Investigation, sketch: Sketch): void
}>()

const investigations = ref<Investigation[]>([])
const openInv = ref('')
const busy = ref(false)
const invBusy = ref(false)

const newInvPrompt = ref(false)
const newInvName = ref('')
const newInvDesc = ref('')

const newSketchFor = ref<Investigation | null>(null)
const newSketchTitle = ref('')

async function load() {
  busy.value = true
  try {
    investigations.value = await investigationApi.list()
  } catch (e) {
    console.error(e)
  } finally {
    busy.value = false
  }
}

async function createInv() {
  invBusy.value = true
  try {
    const inv = await investigationApi.create(newInvName.value, newInvDesc.value)
    investigations.value.push(inv)
    newInvName.value = ''
    newInvDesc.value = ''
    newInvPrompt.value = false
    openInv.value = inv.id
  } catch (e) {
    console.error(e)
  } finally {
    invBusy.value = false
  }
}

async function createSketch() {
  if (!newSketchFor.value) return
  invBusy.value = true
  try {
    const sk = await sketchApi.create(newSketchTitle.value, '', newSketchFor.value.id)
    const inv = investigations.value.find((i) => i.id === newSketchFor!.value!.id)
    if (inv) {
      inv.sketches = inv.sketches || []
      inv.sketches.push(sk)
    }
    emit('select', newSketchFor.value, sk)
    newSketchTitle.value = ''
    newSketchFor.value = null
  } catch (e) {
    console.error(e)
  } finally {
    invBusy.value = false
  }
}

function cancelSketch() {
  newSketchFor.value = null
  newSketchTitle.value = ''
}

defineExpose({ load })

onMounted(load)
</script>