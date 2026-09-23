import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'

/**
 * 路由与权限守卫（Demo 使用 hash 模式，便于任意静态服务器直接打开）
 *
 * v0.5 改造：由「非公开即需登录」的二元模型，升级为**四类路由矩阵**
 * （依据《13、知练题库 v0.5 需求规格文档.md》§5.1 与 §10.2）：
 *
 * | 路由类别 | meta 标记 | 游客 | 普通登录用户 | 管理员 |
 * | --- | --- | --- | --- | --- |
 * | 游客态页面 | `public` | 放行 | 放行（已登录访问 /login → 回首页） | 放行 |
 * | 完全公开（只读） | `guestViewable` | 放行 | 放行 | 放行 |
 * | 需登录 | （默认） | 拦截 → 登录页 + redirect 回跳 | 放行 | 放行 |
 * | 管理员专属 | `requiresAdmin` | 拦截 → 登录页 + 回跳 | **放行但不渲染内容**（由外壳渲染无权限提示块） | 放行 |
 *
 * 关键点：**管理员路由不再重定向首页**。原来的 `return { path: '/' }` 会让用户「点了一下就被弹走、
 * 不知道自己点了什么」；现在放行并由 AppLayout 原地渲染 S3 无权限提示块，URL 保持不变。
 * 资源级权限（私有试卷等）不在守卫里判断，由页面按契约面错误码渲染 S3/S4（见 §5.1 第 3 条）。
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/auth/RegisterView.vue'),
    meta: { title: '注册', public: true },
  },
  {
    path: '/forgot',
    name: 'forgot',
    component: () => import('@/views/auth/ForgotView.vue'),
    meta: { title: '找回密码', public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/home/HomeView.vue'),
        // 公开试卷广场：三身份均可浏览（游客进入系统后落地在此，见 §4.1）
        meta: { title: '公开试卷广场', guestViewable: true },
      },
      {
        path: 'my-drafts',
        name: 'my-drafts',
        component: () => import('@/views/draft/MyDraftListView.vue'),
        meta: { title: '我的试卷' },
      },
      {
        path: 'drafts/:id',
        name: 'draft-detail',
        component: () => import('@/views/draft/DraftDetailView.vue'),
        // 游客可预览公开试卷（不含答案与解析）；私有试卷由页面按 403/404 渲染 S3/S4
        meta: { title: '试卷详情', guestViewable: true },
      },
      {
        path: 'drafts/:id/edit',
        name: 'draft-edit',
        component: () => import('@/views/draft/DraftEditView.vue'),
        meta: { title: '编辑试卷' },
      },
      /* --- v1-plus 模块1：知识点知识库（广场与详情对游客开放，见 14 号 §4.1）--- */
      {
        path: 'knowledge',
        name: 'knowledge-list',
        component: () => import('@/views/knowledge/KnowledgeListView.vue'),
        meta: { title: '知识点广场', guestViewable: true },
      },
      {
        path: 'knowledge/:id',
        name: 'knowledge-detail',
        component: () => import('@/views/knowledge/KnowledgeDetailView.vue'),
        meta: { title: '知识点详情', guestViewable: true },
      },
      {
        // 新建与编辑复用同一页面：`new` 表示新建（14 号 §4.3）
        path: 'knowledge/:id/edit',
        name: 'knowledge-edit',
        component: () => import('@/views/knowledge/KnowledgeEditView.vue'),
        meta: { title: '编辑知识点' },
      },
      {
        path: 'my-knowledge',
        name: 'my-knowledge',
        component: () => import('@/views/knowledge/MyKnowledgeView.vue'),
        meta: { title: '我的知识点' },
      },
      /* --- v1-plus 模块3：多态收藏 --- */
      {
        path: 'favorites',
        name: 'favorites',
        component: () => import('@/views/favorite/MyFavoritesView.vue'),
        meta: { title: '我的收藏' },
      },
      /* --- v1-plus 模块5：个人学习统计大盘（仅本人；路由不带 userId） --- */
      {
        path: 'stats',
        name: 'stats',
        component: () => import('@/views/stats/StatsView.vue'),
        meta: { title: '学习统计' },
      },
      {
        path: 'exam/:id',
        name: 'exam-answer',
        component: () => import('@/views/exam/ExamAnswerView.vue'),
        meta: { title: '答题' },
      },
      {
        path: 'exam/:id/result',
        name: 'exam-result',
        component: () => import('@/views/exam/ExamResultView.vue'),
        meta: { title: '答题回顾' },
      },
      {
        path: 'records',
        name: 'records',
        component: () => import('@/views/exam/ExamRecordListView.vue'),
        meta: { title: '答题记录' },
      },
      {
        path: 'wrong',
        name: 'wrong',
        component: () => import('@/views/wrong/WrongSetView.vue'),
        meta: { title: '错题与已掌握' },
      },
      {
        path: 'compose',
        name: 'compose',
        component: () => import('@/views/compose/ComposeView.vue'),
        meta: { title: '错题组卷' },
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/views/profile/MyProfileView.vue'),
        meta: { title: '我的主页' },
      },
      {
        path: 'u/:userId',
        name: 'user-profile',
        component: () => import('@/views/profile/UserProfileView.vue'),
        // 他人主页：三身份可访问，内容按对方隐私设置裁剪
        meta: { title: '用户主页', guestViewable: true },
      },
      {
        path: 'selfcheck',
        name: 'selfcheck',
        component: () => import('@/views/dev/SelfCheckView.vue'),
        meta: { title: '规则自检' },
      },
    ],
  },
  {
    path: '/admin',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAdmin: true },
    children: [
      {
        path: '',
        redirect: '/admin/categories',
      },
      {
        path: 'categories',
        name: 'admin-categories',
        component: () => import('@/views/admin/CategoryManageView.vue'),
        meta: { title: '试卷分类' },
      },
      {
        path: 'tags',
        name: 'admin-tags',
        component: () => import('@/views/admin/TagManageView.vue'),
        meta: { title: '考点标签' },
      },
      {
        path: 'questions',
        name: 'admin-questions',
        component: () => import('@/views/admin/QuestionBankView.vue'),
        meta: { title: '题库纠错' },
      },
      {
        path: 'discarded',
        name: 'admin-discarded',
        component: () => import('@/views/admin/DiscardedDraftView.vue'),
        meta: { title: '废弃试卷审计' },
      },
      {
        path: 'user-manage',
        name: 'admin-user-manage',
        component: () => import('@/views/admin/UserManageView.vue'),
        meta: { title: '用户账号管理' },
      },
      /* --- v1-plus 模块4：反馈工单管理 --- */
      {
        path: 'feedback',
        name: 'admin-feedback',
        component: () => import('@/views/admin/FeedbackManageView.vue'),
        meta: { title: '反馈工单' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const userStore = useUserStore()
  if (!userStore.user) {
    await userStore.loadCurrent()
  }

  // ① 游客态页面（登录 / 注册 / 找回密码）
  if (to.meta.public) {
    // 已登录访问登录页 → 回到首页
    if (userStore.user && to.name === 'login') return { path: '/' }
    return true
  }

  // ② 完全公开（只读）页面：游客放行
  if (to.meta.guestViewable) return true

  // ③ 需登录页面：拦截并带回跳地址
  if (!userStore.user) {
    const query: Record<string, string> = { redirect: to.fullPath }
    // 区分「游客主动访问」与「登录已失效」——登录页提示文案不同（§6.3 PER-02）
    if (userStore.sessionExpired) query.expired = '1'
    return { path: '/login', query }
  }

  // ④ 管理员专属：**放行**，由 AppLayout 原地渲染无权限提示块（URL 不变，见文件头说明）
  return true
})

router.afterEach((to) => {
  const title = (to.meta.title as string) ?? ''
  document.title = title ? `${title} · 知练题库 Demo` : '知练题库 Demo'
})

export default router
