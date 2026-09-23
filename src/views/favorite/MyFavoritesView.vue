<script setup lang="ts">
/**
 * 我的收藏 `/favorites`（v1-plus 模块3）
 *
 * 依据《14、v1 plus.md》模块3 与 15 号 FA-01 ~ FA-07：
 *   - 三个 Tab：收藏的试卷 / 题目 / 知识点，**每个 Tab 分页状态完全独立**（FA-05）
 *   - 条目点击跳转对应资源；题目跳到所在试卷预览页并定位高亮该题（Q11 已定案）
 *   - 资源被废弃 / 转私有 / 删除：**收藏记录不删除**，条目置灰 + 「资源已不可访问」，仍可取消收藏（FA-02/03）
 *   - 取消收藏后条目移除；资源页面的按钮状态由同一次请求的返回值驱动，天然同步
 */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, type FavoriteItem } from '@/api'
import { Copy } from '@/constants/copy'
import { FavoriteTargetType } from '@/constants/enums'
import { usePagination } from '@/composables/usePagination'
import { useUserStore } from '@/stores/user'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const activeTab = ref<'draft' | 'question' | 'knowledge'>('draft')

const drafts = ref<FavoriteItem[]>([])
const questions = ref<FavoriteItem[]>([])
const knowledge = ref<FavoriteItem[]>([])

/* 三个 Tab 各自独立分页（10 号快照 §5：禁止跨列表共用 currentPage / pageSize） */
const {
  currentPage: draftPage,
  pageSize: draftSize,
  total: draftTotal,
  pagedList: pagedDrafts,
} = usePagination(drafts, 10)
const {
  currentPage: questionPage,
  pageSize: questionSize,
  total: questionTotal,
  pagedList: pagedQuestions,
} = usePagination(questions, 10)
const {
  currentPage: knowledgePage,
  pageSize: knowledgeSize,
  total: knowledgeTotal,
  pagedList: pagedKnowledge,
} = usePagination(knowledge, 10)

async function load() {
  loading.value = true
  try {
    drafts.value = await api.favorite.list(userStore.userId, FavoriteTargetType.DRAFT)
    questions.value = await api.favorite.list(userStore.userId, FavoriteTargetType.QUESTION)
    knowledge.value = await api.favorite.list(userStore.userId, FavoriteTargetType.KNOWLEDGE)
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

/** 取消收藏：即使资源已不可访问也允许（15 号 FA-02） */
async function cancel(item: FavoriteItem) {
  try {
    await ElMessageBox.confirm(
      `确认取消收藏「${item.title}」？取消后可在资源页面重新收藏。`,
      '取消收藏',
      { type: 'warning', confirmButtonText: '取消收藏' },
    )
    await api.favorite.toggle(userStore.userId, item.targetType, item.targetId)
    ElMessage.success('已取消收藏')
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((e as Error).message)
  }
}

function open(item: FavoriteItem) {
  if (!item.available || !item.link) {
    ElMessage.warning(Copy.resourceUnavailable)
    return
  }
  void router.push(item.link)
}

function formatTime(value: string): string {
  return value ? new Date(value).toLocaleString('zh-CN') : '—'
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">我的收藏</h2>
        <p class="page-desc">
          收藏的试卷、题目、知识点都在这儿。资源被作者转成私有或被删掉时，这里会留着记录并置灰，
          方便你知道「收藏过它」，也可以直接取消收藏。
        </p>
      </div>
    </div>

    <div v-loading="loading" class="ql-panel">
      <!-- el-tabs 必须显式 v-model，否则命名 pane 可能出现无激活项 -->
      <el-tabs v-model="activeTab">
        <!-- ① 收藏的试卷 -->
        <el-tab-pane :label="`收藏的试卷（${drafts.length}）`" name="draft">
          <div v-if="drafts.length > 0" class="fav-list">
            <div
              v-for="item in pagedDrafts"
              :key="item.id"
              class="fav-item"
              :class="{ 'is-unavailable': !item.available }"
            >
              <div
                class="fav-main"
                role="link"
                tabindex="0"
                @click="open(item)"
                @keydown.enter.prevent="open(item)"
              >
                <div class="fav-title">{{ item.title }}</div>
                <div class="fav-sub">
                  <span>{{ item.subtitle }}</span>
                  <span class="text-tip">收藏于 {{ formatTime(item.favoritedAt) }}</span>
                </div>
              </div>
              <div class="fav-actions">
                <el-tag v-if="!item.available" size="small" type="info" effect="plain">
                  {{ Copy.resourceUnavailable }}
                </el-tag>
                <el-button v-else size="small" text type="primary" @click="open(item)">
                  查看
                </el-button>
                <el-button size="small" text type="danger" @click="cancel(item)">取消收藏</el-button>
              </div>
            </div>
          </div>
          <EmptyState
            v-else
            icon="ph:star"
            desc="还没有收藏试卷。在公开试卷详情页点「收藏」就会出现在这里。"
            compact
          />
          <div v-if="draftTotal > 0" class="tab-pager">
            <el-pagination
              v-model:current-page="draftPage"
              v-model:page-size="draftSize"
              :page-sizes="[10, 20, 50]"
              :total="draftTotal"
              layout="total, sizes, prev, pager, next"
              background
            />
          </div>
        </el-tab-pane>

        <!-- ② 收藏的题目 -->
        <el-tab-pane :label="`收藏的题目（${questions.length}）`" name="question">
          <div v-if="questions.length > 0" class="fav-list">
            <div
              v-for="item in pagedQuestions"
              :key="item.id"
              class="fav-item"
              :class="{ 'is-unavailable': !item.available }"
            >
              <div
                class="fav-main"
                role="link"
                tabindex="0"
                @click="open(item)"
                @keydown.enter.prevent="open(item)"
              >
                <div class="fav-title">{{ item.title }}</div>
                <div class="fav-sub">
                  <span>{{ item.subtitle }}</span>
                  <span class="text-tip">收藏于 {{ formatTime(item.favoritedAt) }}</span>
                </div>
              </div>
              <div class="fav-actions">
                <el-tag v-if="!item.available" size="small" type="info" effect="plain">
                  {{ Copy.resourceUnavailable }}
                </el-tag>
                <el-button v-else size="small" text type="primary" @click="open(item)">
                  去试卷定位
                </el-button>
                <el-button size="small" text type="danger" @click="cancel(item)">取消收藏</el-button>
              </div>
            </div>
          </div>
          <EmptyState
            v-else
            icon="ph:star"
            desc="还没有收藏题目。在错题卡片上点星标就会出现在这里。"
            compact
          />
          <div v-if="questionTotal > 0" class="tab-pager">
            <el-pagination
              v-model:current-page="questionPage"
              v-model:page-size="questionSize"
              :page-sizes="[10, 20, 50]"
              :total="questionTotal"
              layout="total, sizes, prev, pager, next"
              background
            />
          </div>
        </el-tab-pane>

        <!-- ③ 收藏的知识点 -->
        <el-tab-pane :label="`收藏的知识点（${knowledge.length}）`" name="knowledge">
          <div v-if="knowledge.length > 0" class="fav-list">
            <div
              v-for="item in pagedKnowledge"
              :key="item.id"
              class="fav-item"
              :class="{ 'is-unavailable': !item.available }"
            >
              <div
                class="fav-main"
                role="link"
                tabindex="0"
                @click="open(item)"
                @keydown.enter.prevent="open(item)"
              >
                <div class="fav-title">{{ item.title }}</div>
                <div class="fav-sub">
                  <span>{{ item.subtitle }}</span>
                  <span class="text-tip">收藏于 {{ formatTime(item.favoritedAt) }}</span>
                </div>
              </div>
              <div class="fav-actions">
                <el-tag v-if="!item.available" size="small" type="info" effect="plain">
                  {{ Copy.resourceUnavailable }}
                </el-tag>
                <el-button v-else size="small" text type="primary" @click="open(item)">查看</el-button>
                <el-button size="small" text type="danger" @click="cancel(item)">取消收藏</el-button>
              </div>
            </div>
          </div>
          <EmptyState
            v-else
            icon="ph:star"
            desc="还没有收藏知识点。在知识点广场卡片上点星标、或在详情页点「收藏」就会出现在这里。"
            compact
          />
          <div v-if="knowledgeTotal > 0" class="tab-pager">
            <el-pagination
              v-model:current-page="knowledgePage"
              v-model:page-size="knowledgeSize"
              :page-sizes="[10, 20, 50]"
              :total="knowledgeTotal"
              layout="total, sizes, prev, pager, next"
              background
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <div class="rule-tip mt16">
      收藏只是你自己的标记，<b>不会改变资源的任何状态</b>；三类资源的分页彼此独立、互不干扰。
    </div>
  </div>
</template>

<style scoped>
.fav-list {
  display: flex;
  flex-direction: column;
  gap: var(--ql-s1);
}

.fav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ql-s2);
  padding: 12px var(--ql-s2);
  border: 1px solid var(--ql-border-light);
  border-radius: var(--ql-radius-sm);
  background: var(--ql-surface);
  transition: border-color var(--ql-dur-fast) var(--ql-ease-spring);
}

.fav-item:hover {
  border-color: var(--ql-primary-line);
}

/*
 * 资源不可访问（S4）：辅助色 + 下沉底色表达，
 * **不用整体 opacity**（13 号 §9.7：既保证可读性，也与「置灰不可用」区分开）
 */
.fav-item.is-unavailable {
  background: var(--ql-surface-sunken);
  border-color: var(--ql-border-light);
}

.fav-item.is-unavailable .fav-title {
  color: var(--ql-muted);
}

.fav-main {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.fav-item.is-unavailable .fav-main {
  cursor: not-allowed;
}

.fav-title {
  font-size: var(--ql-fs-body);
  font-weight: 500;
  color: var(--ql-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fav-sub {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  margin-top: 2px;
  font-size: var(--ql-fs-tip);
  color: var(--ql-muted);
}

.fav-actions {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  flex-shrink: 0;
}

.tab-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--ql-s2);
}
</style>
