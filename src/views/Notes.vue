<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storage } from '@/services/storage'

const notes = ref<Awaited<ReturnType<typeof storage.listNotes>>>([])

onMounted(async () => {
  notes.value = await storage.listNotes()
})
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-xl font-semibold">笔记 / 知识库</h2>
    <p class="text-sm text-fg-soft">
      M1 实现 SQLite/Dexie 存储、Markdown 编辑、目录树与全文搜索；V1 支持 Obsidian Vault 直连（wikilinks / 标签 / frontmatter）。
    </p>
    <div v-if="notes.length === 0" class="text-fg-soft text-sm">（暂无笔记）</div>
  </div>
</template>
