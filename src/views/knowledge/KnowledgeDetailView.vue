<script setup lang="ts">
/**
 * 知识点详情 `/knowledge/:id`（v1-plus 模块1）
 *
 * 依据《14、v1 plus.md》§4.2 与 15 号 KD-01 ~ KD-09：
 *   - 私有知识点仅作者可读；已逻辑删除 → S4 原地提示
 *   - 非作者【编辑】【删除】完全不出现（S2 隐藏，不是置灰）
 *   - 未登录：批注面板隐藏（S2）；正文照常可读
 *   - 本人批注仅自己可见；他人永远看不到
 *   - 关联题目中已删除的题目会被移出列表（服务层已过滤）
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, type KnowledgeDetail } from '@/api'
import { Copy } from '@/constants/copy'
import { FavoriteTargetType, QuestionTypeLabel } from '@/constants/enums'
import { useUserStore } from '@/stores/user'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import NoPermissionBlock from '@/components/NoPermissionBlock.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const detail = ref<KnowledgeDetail | null>(null)
const blocked = ref<null | { title: string; desc: string; icon: string }>(null)

/** 批注：仅登录用户可见（游客 S2 隐藏） */
const annotation = ref('')
const annotationSaving = ref(false)
/** 批注折叠面板：默认展开（保留「看到自己的批注」预期），可手动收起 */
const annotationOpen = ref(['annotation'])

const knowledgeId = computed(() => Number(route.params.id))

async function load() {
  loading.value = true
  blocked.value = null
  try {
    detail.value = await api.knowledge.detail(knowledgeId.value, userStore.viewerId)
    annotation.value = detail.value.myAnnotation ?? ''
  } catch (e) {
    detail.value = null
    blocked.value = {
      title: Copy.resourceDeleted,
      desc: (e as Error).message,
      icon: 'ph:file-dashed',
    }
  } finally {
    loading.value = false
  }
}

async function saveAnnotation() {
  annotationSaving.value = true
  try {
    await api.knowledge.saveAnnotation(knowledgeId.value, userStore.userId, annotation.value)
    ElMessage.success(annotation.value.trim() ? '批注已保存（仅你自己可见）' : '批注已清空')
    await load()
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    annotationSaving.value = false
  }
}

async function removeKnowledge() {
  if (!detail.value) return
  try {
    await ElMessageBox.confirm(
      `确认删除知识点「${detail.value.knowledge.title}」？删除后会解除与标签、题目的关联，但不会删除题目本身。`,
      '删除知识点',
      { type: 'warning', confirmButtonText: '删除' },
    )
    await api.knowledge.remove(knowledgeId.value, userStore.userId)
    ElMessage.success('已删除')
    void router.push('/knowledge')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((e as Error).message)
  }
}

function openQuestion(draftId: number | null) {
  if (draftId === null) {
    ElMessage.info('这道题没有可跳转的试卷')
    return
  }
  void router.push(`/drafts/${draftId}`)
}

function formatTime(value?: string): string {
  return value ? new Date(value).toLocaleString('zh-CN') : '—'
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="page page--column">
    <NoPermissionBlock
      v-if="blocked"
      :title="blocked.title"
      :desc="blocked.desc"
      :icon="blocked.icon"
    />

    <template v-else-if="detail">
      <div class="page-header">
        <div>
          <h2 class="page-title">{{ detail.knowledge.title }}</h2>
          <p class="page-desc doc-meta">
            <button type="button" class="author-link" @click="router.push(`/u/${detail.author.id}`)">
              {{ detail.author.username }}
            </button>
            <el-tag v-if="detail.author.deleted !== 0" size="small" type="info" effect="plain">
              {{ Copy.userDeactivated }}
            </el-tag>
            <el-tag
              size="small"
              :type="detail.knowledge.visibility === 2 ? 'success' : 'info'"
              effect="plain"
            >
              {{ detail.knowledge.visibility === 2 ? '公开' : '私有' }}
            </el-tag>
            更新于 {{ formatTime(detail.knowledge.updateTime) }}
          </p>
        </div>
        <div class="page-actions">
          <el-button @click="router.push('/knowledge')">返回广场</el-button>
          <!-- v1-plus 模块3：知识点收藏（公开知识点才可收藏） -->
          <FavoriteButton
            v-if="detail.knowledge.visibility === 2"
            :target-type="FavoriteTargetType.KNOWLEDGE"
            :target-id="detail.knowledge.id"
          />
          <!-- S2：非作者完全不出现编辑/删除入口（14 号 §4.2、15 号 KD-03） -->
          <template v-if="detail.canEdit">
            <el-button @click="router.push(`/knowledge/${detail.knowledge.id}/edit`)">
              编辑
            </el-button>
            <el-button type="danger" plain @click="removeKnowledge">删除</el-button>
          </template>
        </div>
      </div>

      <!-- 正文：复用全站唯一的 Markdown 渲染组件 -->
      <div class="ql-panel">
        <MarkdownViewer :source="detail.knowledge.content" />
      </div>

      <!-- 关联信息 -->
      <section class="flat-section">
        <div class="flat-section__head">
          <span class="flat-section__title">关联考点</span>
          <span class="flat-section__extra">点标签可回到广场按该标签筛选</span>
        </div>
        <div class="tag-flow">
          <button
            v-for="(tagName, index) in detail.tagNames"
            :key="tagName"
            type="button"
            class="tag-chip"
            @click="router.push({ path: '/knowledge', query: { tagId: detail.tagIds[index] } })"
          >
            {{ tagName }}
          </button>
          <span v-if="detail.tagNames.length === 0" class="text-tip">
            这篇知识点没有绑定考点标签（广场仍会展示，按标签筛选时不会命中）
          </span>
        </div>
      </section>

      <section class="flat-section">
        <div class="flat-section__head">
          <span class="flat-section__title">关联题目（{{ detail.questions.length }}）</span>
          <span class="flat-section__extra">点题目跳转到它所在的试卷预览</span>
        </div>
        <div v-if="detail.questions.length > 0" class="question-links">
          <div v-for="item in detail.questions" :key="item.questionId" class="question-link">
            <el-tag size="small" effect="plain">{{ QuestionTypeLabel[item.questionType] }}</el-tag>
            <span class="question-link__title">{{ item.title }}</span>
            <span class="text-tip">{{ item.draftName ?? '未挂试卷' }}</span>
            <el-button size="small" text type="primary" @click="openQuestion(item.draftId)">
              去试卷
            </el-button>
          </div>
        </div>
        <div v-else class="empty-hint">这篇知识点还没有关联题目</div>
      </section>

      <!-- 个人批注：仅登录用户可见（游客整块隐藏）；16 号 C-2 折叠面板化 -->
      <el-collapse v-if="userStore.isLogin" v-model="annotationOpen" class="annotation-collapse">
        <el-collapse-item name="annotation">
          <template #title>
            <span class="annotation-title">
              我的批注
              <span class="text-tip">只有你自己看得到</span>
            </span>
          </template>
          <el-input
            v-model="annotation"
            type="textarea"
            :rows="3"
            placeholder="读到这里的想法、要补的例子、下次要确认的点…"
          />
          <div class="annotation-actions">
            <span class="text-tip">支持 Markdown 语法，保存后只对自己可见</span>
            <el-button type="primary" :loading="annotationSaving" @click="saveAnnotation">
              保存批注
            </el-button>
          </div>
        </el-collapse-item>
      </el-collapse>
    </template>
  </div>
</template>

<style scoped>
/*
 * 标题下方的元信息行（作者 / 可见性标签 / 更新时间）。
 * 原先是纯 inline 排列：作者名、状态标签、时间三者在视觉上互相贴在一起（显得挤）。
 * 改为 flex + 8px 间距，三者间距均匀；窄屏允许换行。
 */
.doc-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ql-s1);
}

.author-link {
  padding: 0;
  border: none;
  background: none;
  color: var(--ql-primary);
  font-size: inherit;
  cursor: pointer;
}

.author-link:hover {
  color: var(--ql-primary-hover);
}

/* 标签胶囊 .tag-flow / .tag-chip 均已收敛到 global.css §11（16 号 C-1），此处不再重复定义 */

.question-links {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.question-link {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  padding: 8px 12px;
  border: 1px solid var(--ql-border-light);
  border-radius: var(--ql-radius-sm);
  background: var(--ql-surface);
}

.question-link__title {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ql-fs-small);
  color: var(--ql-title);
}

.annotation-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ql-s2);
  margin-top: var(--ql-s1);
}

/* 批注折叠面板：白底 + 描边，可折叠（16 号 C-2）；同层不叠加阴影 */
.annotation-collapse {
  margin-top: var(--ql-s3);
  border: 1px solid var(--ql-border);
  border-radius: var(--ql-radius);
  background: var(--ql-surface);
}

.annotation-collapse :deep(.el-collapse-item__header) {
  height: 48px;
  padding: 0 var(--ql-s3);
  border-bottom: none;
  background: transparent;
}

.annotation-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: none;
}

.annotation-collapse :deep(.el-collapse-item__content) {
  padding: 0 var(--ql-s3) var(--ql-s3);
}

.annotation-title {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  font-size: var(--ql-fs-body);
  font-weight: 600;
  color: var(--ql-title);
}
</style>
