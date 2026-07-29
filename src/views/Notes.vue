<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storage } from '@/services/storage'

const notes = ref<Awaited<ReturnType<typeof storage.listNotes>>>([])

onMounted(async () => {
  notes.value = await storage.listNotes()
})
</script>

<template>
  <div class="space-y-5 max-w-2xl">
    <h2 class="text-xl font-bold m-0">笔记 / 知识库</h2>

    <!-- 空状态 -->
    <div v-if="notes.length === 0" class="empty grid place-items-center py-16 rounded-2xl text-center">
      <div class="max-w-sm px-6">
        <span class="chip inline-grid place-items-center w-14 h-14 rounded-2xl mb-3">
          <span class="i-carbon-document text-2xl text-white" />
        </span>
        <h3 class="font-semibold m-0 mb-1.5">还没有笔记</h3>
        <p class="text-sm text-fg-faint m-0 leading-relaxed">
          M1 实现 Markdown 编辑、目录树与全文搜索；<br />
          V1 支持 Obsidian Vault 直连（wikilinks / 标签 / frontmatter）
        </p>
      </div>
    </div>

    <ul v-else class="space-y-2 p-0 m-0 list-none">
      <li v-for="n in notes" :key="n.id" class="note-item px-4 py-3 rounded-xl cursor-pointer">
        {{ n.title }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.empty { border: 1.5px dashed var(--c-border); }

.chip {
  background: var(--c-brand-grad);
  box-shadow: 0 6px 20px var(--c-brand-soft);
}

.note-item {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.note-item:hover {
  border-color: var(--c-brand);
  box-shadow: var(--shadow-sm);
}
</style>
