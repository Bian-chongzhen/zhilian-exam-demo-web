<script setup lang="ts">
/**
 * 知识点广场 `/knowledge`（v1-plus 模块1）
 *
 * 依据《14、v1 plus.md》§4.1 与 §5，以及 15 号文档 KG-01 ~ KG-10：
 *   - 仅展示**公开、未删除**的知识点；游客也能浏览（复用 v0.5 身份底座）
 *   - 搜索**仅标题前缀匹配**，不搜正文
 *   - 分类筛选通过「知识点绑定的标签归属的分类」实现；标签下拉受分类白名单限制
 *   - 卡片不出现编辑/删除按钮（即使是本人创建），管理操作统一去「我的知识点」
 *   - 修改任一筛选项 → 分页强制回到第 1 页
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api, type KnowledgeListItem, type KnowledgeSort } from '@/api'
import { Copy } from '@/constants/copy'
import { FavoriteTargetType } from '@/constants/enums'
import { usePagination } from '@/composables/usePagination'
import { useUserStore } from '@/stores/user'
import GuestGuard from '@/components/GuestGuard.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import type { CategoryDetail } from '@/types/models'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const list = ref<KnowledgeListItem[]>([])
const categories = ref<CategoryDetail[]>([])
const allTags = ref<Array<{ id: number; tagName: string; isEnabled: number }>>([])
/** 当前分类白名单内的标签 id（未选分类时为 null，表示不限制） */
const categoryTagIds = ref<number[] | null>(null)

/** v1-plus 模块3：本人已收藏的知识点 id（批量预取，供卡片标注星标状态） */
const favoritedIds = ref<number[]>([])

const filter = reactive<{
  keyword: string
  categoryId: number | null
  tagIds: number[]
  sort: KnowledgeSort
}>({
  keyword: '',
  categoryId: null,
  tagIds: [],
  sort: 'created',
})

/** 卡片型分页：每页 12 / 24（10 号快照 §5） */
const { currentPage, pageSize, total, pagedList, resetPage } = usePagination(list, 12)

const sortOptions: Array<{ value: KnowledgeSort; label: string }> = [
  { value: 'created', label: '最新创建' },
  { value: 'updated', label: '最新更新' },
  { value: 'title', label: '标题 A-Z' },
]

/** 标签下拉：选中分类后只展示该分类白名单内的标签（15 号 KG-02） */
const tagOptions = computed(() =>
  allTags.value.filter(
    (t) =>
      t.isEnabled === 1 && (categoryTagIds.value === null || categoryTagIds.value.includes(t.id)),
  ),
)

async function loadTags() {
  if (filter.categoryId === null) {
    categoryTagIds.value = null
    return
  }
  const config = await api.category.tagConfig(filter.categoryId)
  categoryTagIds.value = config.tagIds
  // 切分类后要把不在白名单里的已选标签清掉，避免出现「选了但下拉里看不到」的悬空状态
  filter.tagIds = filter.tagIds.filter((id) => config.tagIds.includes(id))
}

async function load() {
  loading.value = true
  try {
    list.value = await api.knowledge.listPublic({
      keyword: filter.keyword,
      categoryId: filter.categoryId,
      tagIds: [...filter.tagIds],
      sort: filter.sort,
    })
    // v1-plus 模块3：批量取「已收藏的知识点 id」，避免每张卡片各发一次请求
    favoritedIds.value = userStore.isLogin
      ? await api.favorite.listIds(userStore.userId, FavoriteTargetType.KNOWLEDGE)
      : []
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

/** 收藏状态变化：只改本地集合，不重新拉列表（否则分页与筛选会被打断） */
function onFavoriteChange(knowledgeId: number, favorited: boolean) {
  if (favorited) {
    if (!favoritedIds.value.includes(knowledgeId)) favoritedIds.value.push(knowledgeId)
  } else {
    favoritedIds.value = favoritedIds.value.filter((id) => id !== knowledgeId)
  }
}

/** 任一筛选项变化都要回到第 1 页（15 号 KG-07） */
async function applyFilter() {
  resetPage()
  await load()
}

async function onCategoryChange() {
  await loadTags()
  await applyFilter()
}

async function resetFilter() {
  filter.keyword = ''
  filter.categoryId = null
  filter.tagIds = []
  filter.sort = 'created'
  categoryTagIds.value = null
  await applyFilter()
}

/** 点卡片上的标签胶囊 → 填入筛选条件并刷新（15 号 KG-10） */
async function filterByTag(tagId: number) {
  if (categoryTagIds.value !== null && !categoryTagIds.value.includes(tagId)) {
    // 该标签不在当前分类白名单内：先清掉分类，保证筛选条件自洽
    filter.categoryId = null
    categoryTagIds.value = null
  }
  filter.tagIds = [tagId]
  await applyFilter()
}

function formatTime(value?: string): string {
  return value ? new Date(value).toLocaleDateString('zh-CN') : '—'
}

onMounted(async () => {
  // 支持从详情页点标签跳过来（/knowledge?tagId=3&categoryId=1）
  const qTag = Number(route.query.tagId)
  const qCategory = Number(route.query.categoryId)
  if (Number.isFinite(qTag) && qTag > 0) filter.tagIds = [qTag]
  if (Number.isFinite(qCategory) && qCategory > 0) filter.categoryId = qCategory

  categories.value = await api.category.list()
  allTags.value = await api.tag.list()
  await loadTags()
  await load()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">知识点广场</h2>
        <p class="page-desc">
          把一类题的解法写成一篇 Markdown 讲义，下次做错直接翻这里。
          广场只收公开知识点，私有讲义只有自己看得到。
        </p>
      </div>
      <div class="page-actions">
        <!-- S2：游客看不到「我的知识点」入口 -->
        <el-button v-if="userStore.isLogin" @click="router.push('/my-knowledge')">
          我的知识点
        </el-button>
        <!-- S1：游客置灰 + tooltip + 点击弹登录（13 号 §9.2 / §4.4 方式A） -->
        <GuestGuard>
          <el-button
            type="primary"
            :disabled="userStore.isGuest"
            @click="router.push('/knowledge/new/edit')"
          >
            创建知识点
          </el-button>
        </GuestGuard>
      </div>
    </div>

    <!-- 筛选区 -->
    <div class="filter-bar">
      <el-input
        v-model="filter.keyword"
        placeholder="按标题前缀搜索（不搜正文）"
        style="width: 260px"
        clearable
        @keyup.enter="applyFilter"
        @clear="applyFilter"
      />
      <el-select
        v-model="filter.categoryId"
        placeholder="全部试卷分类"
        clearable
        style="width: 180px"
        @change="onCategoryChange"
      >
        <el-option
          v-for="category in categories"
          :key="category.id"
          :label="category.categoryName"
          :value="category.id"
        />
      </el-select>
      <el-select
        v-model="filter.tagIds"
        multiple
        collapse-tags
        collapse-tags-tooltip
        placeholder="全部考点标签"
        style="width: 240px"
        @change="applyFilter"
      >
        <el-option v-for="tag in tagOptions" :key="tag.id" :label="tag.tagName" :value="tag.id" />
      </el-select>
      <el-select v-model="filter.sort" style="width: 140px" @change="applyFilter">
        <el-option v-for="o in sortOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <el-button type="primary" @click="applyFilter">查询</el-button>
      <el-button text @click="resetFilter">重置</el-button>
      <div class="filter-bar__spacer"></div>
      <span class="text-tip">共 {{ total }} 篇公开知识点</span>
    </div>

    <!-- 卡片列表 -->
    <div v-loading="loading" class="knowledge-grid">
      <article
        v-for="item in pagedList"
        :key="item.id"
        class="ql-panel knowledge-card is-hoverable"
        @click="router.push(`/knowledge/${item.id}`)"
      >
        <h3 class="knowledge-card__title">{{ item.title }}</h3>
        <p class="knowledge-card__summary">{{ item.summary || '（这篇还没有写摘要）' }}</p>

        <div class="knowledge-card__tags">
          <button
            v-for="(tagName, index) in item.tagNames"
            :key="tagName"
            type="button"
            class="tag-chip"
            @click.stop="filterByTag(item.tagIds[index])"
          >
            {{ tagName }}
          </button>
          <span v-if="item.tagNames.length === 0" class="text-tip">未绑定考点标签</span>
        </div>

        <div class="knowledge-card__foot">
          <div class="knowledge-card__meta">
            <button
              type="button"
              class="author-link"
              @click.stop="router.push(`/u/${item.userId}`)"
            >
              {{ item.authorName }}
            </button>
            <el-tag v-if="item.authorDeleted" size="small" type="info" effect="plain">
              {{ Copy.userDeactivated }}
            </el-tag>
            <span class="text-tip">更新于 {{ formatTime(item.updateTime) }}</span>
          </div>
          <div class="knowledge-card__foot-actions">
            <!-- v1-plus 模块3：广场卡片收藏（未登录由 GuestGuard 承接点击引导） -->
            <FavoriteButton
              :target-type="FavoriteTargetType.KNOWLEDGE"
              :target-id="item.id"
              :initial="favoritedIds.includes(item.id)"
              compact
              @change="(state: boolean) => onFavoriteChange(item.id, state)"
            />
            <el-button
              size="small"
              text
              type="primary"
              @click.stop="router.push(`/knowledge/${item.id}`)"
            >
              查看
            </el-button>
          </div>
        </div>
      </article>
    </div>

    <!-- 空状态（15 号 KG-06 固定文案；16 号 C-4 统一版式） -->
    <div v-if="!loading && total === 0" class="ql-panel">
      <EmptyState
        icon="ph:book-open"
        title="没找到知识点"
        :desc="Copy.knowledgeEmpty"
        :action-text="userStore.isLogin ? '创建知识点' : ''"
        @action="router.push('/knowledge/new/edit')"
      />
    </div>

    <!-- 卡片型分页：独立面板，常驻（有数据即显示） -->
    <div v-if="total > 0" class="ql-panel pagination-panel">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[12, 24]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        background
      />
    </div>
  </div>
</template>

<style scoped>
/* 卡片网格：自适应列宽，非等比间距 */
.knowledge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: var(--ql-s2);
}

.knowledge-card {
  display: flex;
  flex-direction: column;
  gap: var(--ql-s1);
  margin-bottom: 0;
  cursor: pointer;
  transition: box-shadow var(--ql-dur-fast) var(--ql-ease-spring);
}

.knowledge-card:hover {
  box-shadow: var(--ql-shadow-hover);
}

.knowledge-card__title {
  margin: 0;
  font-size: var(--ql-fs-section);
  font-weight: 600;
  color: var(--ql-title);
  line-height: 1.45;
  /* 最多两行、超出省略；不设 min-height —— 短标题下方不该出现大片空白 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 摘要最多两行溢出省略（16 号 §9.3 卡片规范） */
.knowledge-card__summary {
  margin: 0;
  font-size: var(--ql-fs-small);
  color: var(--ql-muted);
  /*
   * 行高取 1.6：两行 = 13 × 1.6 × 2 = 41.6px ≤ min-height 42px，
   * 使「一行摘要」与「两行摘要」的卡片内部高度完全一致。
   * 若用 1.65（两行 42.9px）会高出 min-height 0.9px，同一行卡片之间
   * 就会产生 1px 级差异，下方的 tags / foot 行随之错位。
   */
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 42px;
}

.knowledge-card__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  /* 与胶囊等高，保证「有标签」和「未绑定考点标签」两种状态下该行高度一致 */
  min-height: 22px;
}

/* 标签胶囊 .tag-chip 已收敛到 global.css §11（16 号 C-1），此处只留布局 */
.knowledge-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ql-s1);
  margin-top: auto;
  padding-top: var(--ql-s1);
  border-top: 1px solid var(--ql-border-light);
}

.knowledge-card__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
  font-size: var(--ql-fs-tip);
  line-height: 1.6;
}

/*
 * 底部操作区必须显式 flex 居中。
 * 修复前它是普通 block：内部的「收藏按钮」（包在 GuestGuard 的 inline-flex span 里，
 * 基线取首个子项）与「查看按钮」（EP 的 inline-flex，带 vertical-align: middle）
 * 按 inline 规则各自对齐，于是两者垂直错位；block 底部还会多出一个行盒的
 * descender 空白，使卡片底边留白异常。
 */
.knowledge-card__foot-actions {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
  flex-shrink: 0;
}

/* 作者名与「更新于」统一行高，保证两者严格同基线（原先 button 用 normal、span 用 1.7） */
.knowledge-card__meta .author-link,
.knowledge-card__meta .text-tip {
  line-height: 1.6;
}

.author-link {
  padding: 0;
  border: none;
  background: none;
  color: var(--ql-primary);
  font-size: var(--ql-fs-tip);
  cursor: pointer;
}

.author-link:hover {
  color: var(--ql-primary-hover);
}

.pagination-panel {
  display: flex;
  justify-content: center;
  padding: var(--ql-s2);
}
</style>
