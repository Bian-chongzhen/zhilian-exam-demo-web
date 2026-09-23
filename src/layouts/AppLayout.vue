<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import { PrivacyTypeLabel } from '@/constants/enums'
import { useUserStore } from '@/stores/user'
import NoPermissionBlock from '@/components/NoPermissionBlock.vue'

/**
 * 全局外壳：左侧可折叠侧边导航 + 顶部 header + 右侧主内容区（含面包屑）
 * 依据《8、页面布局设计.md》全局布局规范。
 *
 * v0.5 变更（《13、知练题库 v0.5 需求规格文档.md》）：
 *   - §5.2：菜单按**身份**渲染 —— 游客只保留「公开试卷广场」，个人中心与管理后台分组隐藏
 *   - §4.4：游客 header 显示【登录】【注册】，不显示头像下拉（「重置演示数据」随之对游客隐藏）
 *   - §9.2 S3：越权访问 /admin/* 时**原地**渲染无权限提示块（URL 不变，不跳首页）
 *   - §8.1（16 号）：业务语义图标统一走 Iconify `ph`，不再用 Element Plus 图标
 */
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const COLLAPSE_KEY = 'zhilian-demo-aside-collapsed'
const collapsed = ref(false)

/** 公开分组：三身份均可见 */
const publicMenu = [
  { path: '/', title: '公开试卷广场', icon: 'ph:compass' },
  // v1-plus 模块1：知识点广场对游客可见（13 号 §5.2）
  { path: '/knowledge', title: '知识点广场', icon: 'ph:book-bookmark' },
]

/** 个人分组：仅登录用户与管理员可见（游客隐藏，且路由层也会拦截直连） */
const personalMenu = [
  { path: '/my-drafts', title: '我的试卷', icon: 'ph:files' },
  { path: '/my-knowledge', title: '我的知识点', icon: 'ph:notebook' },
  { path: '/favorites', title: '我的收藏', icon: 'ph:star' },
  { path: '/compose', title: '错题组卷', icon: 'ph:magic-wand' },
  { path: '/wrong', title: '错题与已掌握', icon: 'ph:stack' },
  { path: '/records', title: '答题记录', icon: 'ph:ticket' },
  { path: '/stats', title: '学习统计', icon: 'ph:chart-line-up' },
  { path: '/profile', title: '我的主页', icon: 'ph:user' },
]

/** 管理后台分组：仅管理员可见（分组标题与菜单项一同隐藏） */
const adminMenu = [
  { path: '/admin/categories', title: '试卷分类', icon: 'ph:folder' },
  { path: '/admin/tags', title: '考点标签', icon: 'ph:tag' },
  { path: '/admin/questions', title: '题库纠错', icon: 'ph:pencil-simple' },
  { path: '/admin/discarded', title: '废弃试卷审计', icon: 'ph:trash' },
  { path: '/admin/user-manage', title: '用户账号管理', icon: 'ph:user-gear' },
  { path: '/admin/feedback', title: '反馈工单', icon: 'ph:flag' },
]

/** 菜单按身份渲染：游客只看到公开分组 */
const visibleMenu = computed(() => (userStore.isGuest ? publicMenu : [...publicMenu, ...personalMenu]))

/**
 * S3：管理员专属路由对非管理员「放行但渲染提示块」。
 * 守卫不再重定向首页，所以这个判断放在外壳里，保证 URL 不变、菜单与面包屑仍可见。
 */
const routeDenied = computed(
  () => route.matched.some((r) => r.meta.requiresAdmin) && !userStore.isAdmin,
)

/** 侧边栏高亮：列表页与详情页归属同一父级菜单 */
const activeMenu = computed(() => {
  const path = route.path
  if (path.startsWith('/drafts')) return '/my-drafts'
  if (path.startsWith('/exam')) return '/records'
  if (path.startsWith('/u/')) return '/profile'
  // 知识点详情/编辑页归属「知识点广场」；我的知识点是独立菜单项
  if (path.startsWith('/knowledge')) return '/knowledge'
  return path
})

/** 面包屑：按路由前缀给出「分组 / 页面」路径 */
const breadcrumb = computed(() => {
  const path = route.path
  const title = (route.meta.title as string) ?? ''
  const group = (() => {
    if (path.startsWith('/admin')) return '管理后台'
    if (path === '/') return '题库广场'
    if (path.startsWith('/drafts') || path.startsWith('/my-drafts')) return '试卷管理'
    if (path.startsWith('/exam') || path.startsWith('/records')) return '答题中心'
    if (path.startsWith('/wrong')) return '错题中心'
    if (path.startsWith('/compose')) return '错题中心'
    if (path.startsWith('/profile') || path.startsWith('/u/')) return '个人中心'
    if (path.startsWith('/knowledge') || path.startsWith('/my-knowledge')) return '知识库'
    if (path.startsWith('/selfcheck')) return '开发工具'
    return '首页'
  })()
  const current = title || group
  return [group === current ? '首页' : group, current]
})

function toggleCollapse() {
  collapsed.value = !collapsed.value
  localStorage.setItem(COLLAPSE_KEY, collapsed.value ? '1' : '0')
}

/** 游客点【登录】：带上当前地址，登录成功后回到原处（§4.3 回跳要求） */
function goLogin() {
  void router.push({ path: '/login', query: { redirect: route.fullPath } })
}

async function handleCommand(command: string) {
  if (command === 'profile') return void router.push('/profile')
  if (command === 'admin') return void router.push('/admin/categories')
  if (command === 'selfcheck') return void router.push('/selfcheck')
  if (command === 'guide-drafts') return void router.push('/my-drafts')
  if (command === 'guide-compose') return void router.push('/compose')
  if (command === 'guide-short') return void router.push('/')
  if (command === 'logout') {
    await userStore.logout()
    ElMessage.success('已退出登录')
    // 退出后成为游客态：落到公开试卷广场，而不是登录页（13 号 §11 Q6 已定案）
    return void router.push('/')
  }
  if (command === 'reset') {
    await ElMessageBox.confirm('将清空本地所有演示改动并恢复初始假数据，是否继续？', '重置演示数据', {
      type: 'warning',
    })
    await api.auth.resetDemoData()
    // 走 store 的统一入口清空本地会话态（顺带清掉 token，避免只置空 user 留下半截状态）
    userStore.clearLocalSession()
    ElMessage.success('演示数据已重置，请重新登录')
    void router.push('/login')
  }
}

onMounted(() => {
  collapsed.value = localStorage.getItem(COLLAPSE_KEY) === '1'
})
</script>

<template>
  <div class="shell">
    <!-- 左侧可折叠导航 -->
    <aside class="shell-aside" :class="{ 'is-collapsed': collapsed }">
      <div class="shell-brand" @click="router.push('/')">
        <div class="brand-logo">知</div>
        <div v-show="!collapsed" class="brand-text">
          <div class="brand-name">知练题库</div>
          <div class="brand-sub">Demo · v0.5</div>
        </div>
      </div>

      <el-scrollbar class="shell-nav">
        <el-menu :default-active="activeMenu" :collapse="collapsed" :collapse-transition="false" router>
          <el-menu-item v-for="item in visibleMenu" :key="item.path" :index="item.path">
            <el-icon><Icon :icon="item.icon" class="nav-ico" /></el-icon>
            <template #title>{{ item.title }}</template>
          </el-menu-item>
        </el-menu>

        <template v-if="userStore.isAdmin">
          <div v-show="!collapsed" class="shell-group">管理后台</div>
          <el-menu
            :default-active="activeMenu"
            :collapse="collapsed"
            :collapse-transition="false"
            router
          >
            <el-menu-item v-for="item in adminMenu" :key="item.path" :index="item.path">
              <el-icon><Icon :icon="item.icon" class="nav-ico" /></el-icon>
              <template #title>{{ item.title }}</template>
            </el-menu-item>
          </el-menu>
        </template>
      </el-scrollbar>

      <div v-show="!collapsed" class="shell-aside-foot">
        <el-tag size="small" effect="plain" type="info">Mock 真逻辑层</el-tag>
      </div>
    </aside>

    <!-- 右侧：header + 主内容 -->
    <div class="shell-body">
      <header class="shell-header">
        <div class="header-left">
          <el-button
            text
            class="collapse-btn"
            :title="collapsed ? '展开导航' : '折叠导航'"
            @click="toggleCollapse"
          >
            <Icon
              :icon="collapsed ? 'ph:caret-double-right' : 'ph:caret-double-left'"
              class="ico-btn"
            />
          </el-button>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item v-for="(item, index) in breadcrumb" :key="index">
              {{ item }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="header-right">
          <el-tooltip content="当前为纯前端 Demo：数据保存在浏览器本地，可重置" placement="bottom">
            <el-tag size="small" effect="plain" round>演示环境</el-tag>
          </el-tooltip>

          <!-- 演示导航入口（不伪造站内信等业务数据，仅作使用指引） -->
          <el-dropdown trigger="click" @command="handleCommand">
            <el-button text class="icon-btn">
              <Icon icon="ph:compass" class="ico-btn" />
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="selfcheck">
                  <Icon icon="ph:seal-check" class="ico-menu" />规则自检（自动断言业务规则）
                </el-dropdown-item>
                <el-dropdown-item command="guide-drafts">
                  <Icon icon="ph:files" class="ico-menu" />试卷锁定：启用后永久只读
                </el-dropdown-item>
                <el-dropdown-item command="guide-compose">
                  <Icon icon="ph:magic-wand" class="ico-menu" />错题组卷：双重加权抽题
                </el-dropdown-item>
                <el-dropdown-item command="guide-short">
                  <Icon icon="ph:pencil-simple" class="ico-menu" />简答题 v1：交卷后对照答案自评
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <!-- 游客：右上角显示【登录】【注册】（13 号 §4.4 第 1 条）；
               头像下拉整体不出现，因此「重置演示数据」「我的主页」「管理后台」对游客自然隐藏（§11 Q7） -->
          <template v-if="userStore.isGuest">
            <el-button size="small" @click="goLogin">登录</el-button>
            <el-button size="small" type="primary" @click="router.push('/register')">注册</el-button>
          </template>

          <el-dropdown v-else @command="handleCommand">
            <div class="user-chip">
              <el-avatar :size="28" class="user-avatar">
                {{ userStore.displayName.slice(0, 1).toUpperCase() }}
              </el-avatar>
              <div class="user-meta">
                <div class="user-name">
                  {{ userStore.displayName }}
                  <el-tag v-if="userStore.isAdmin" size="small" type="warning" effect="plain">
                    管理员
                  </el-tag>
                </div>
                <div class="user-privacy">
                  {{ PrivacyTypeLabel[userStore.user?.privacyType ?? 1] }}主页
                </div>
              </div>
              <Icon icon="ph:caret-down" class="user-caret" />
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <Icon icon="ph:user" class="ico-menu" />我的主页 / 设置
                </el-dropdown-item>
                <el-dropdown-item v-if="userStore.isAdmin" command="admin">
                  <Icon icon="ph:gear-six" class="ico-menu" />管理后台
                </el-dropdown-item>
                <el-dropdown-item command="selfcheck">
                  <Icon icon="ph:seal-check" class="ico-menu" />规则自检
                </el-dropdown-item>
                <el-dropdown-item command="reset" divided>
                  <Icon icon="ph:arrows-clockwise" class="ico-menu" />重置演示数据
                </el-dropdown-item>
                <el-dropdown-item command="logout">
                  <Icon icon="ph:sign-out" class="ico-menu" />退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="shell-main">
        <!-- S3：越权访问管理后台时不跳转、原地提示（13 号 §9.2 S3） -->
        <NoPermissionBlock v-if="routeDenied" />
        <router-view v-else />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--ql-bg);
}

/* ---------------------------- 侧边栏 ---------------------------- */
.shell-aside {
  width: var(--ql-aside-w);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  /* 侧边栏独立浅灰底（--ql-aside #eff1f5），比主内容区（--ql-bg #f7f8fa）深一档，
     与白色顶栏 / 白色卡片形成三层分区（V2.0 设计规格：页面外层极浅冷灰、侧边栏独立浅灰、卡片白） */
  background: var(--ql-aside);
  border-right: 1px solid var(--ql-border-light);
  transition: width var(--ql-dur-panel) var(--ql-ease-spring);
}

.shell-aside.is-collapsed {
  width: var(--ql-aside-w-collapsed);
}

.shell-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--ql-header-h);
  padding: 0 var(--ql-s2);
  border-bottom: 1px solid var(--ql-border-light);
  cursor: pointer;
  flex-shrink: 0;
}

.brand-logo {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: var(--ql-radius-sm);
  background: var(--ql-primary-fill);
  /* 主色实心底 + 近白文字（对比度 6.0:1，见 global.css §1 的 --ql-on-primary 说明） */
  color: var(--ql-on-primary);
  font-weight: 700;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Iconify 图标尺寸（16 号 §8.1：导航 18px / 按钮 16-17px） */
.nav-ico {
  font-size: 18px;
}

.ico-btn {
  font-size: 17px;
}

.ico-menu {
  font-size: 16px;
  margin-right: 6px;
}

.brand-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--ql-title);
  line-height: 1.3;
}

.brand-sub {
  font-size: var(--ql-fs-tip);
  color: var(--ql-muted);
  line-height: 1.3;
}

.shell-nav {
  flex: 1;
  padding: var(--ql-s1) 0;
}

.shell-group {
  padding: var(--ql-s2) 16px 4px;
  font-size: var(--ql-fs-tip);
  color: var(--ql-muted);
  letter-spacing: 0.04em;
}

.shell-aside-foot {
  padding: var(--ql-s2);
  border-top: 1px solid var(--ql-border-light);
  text-align: center;
}

/* ---------------------------- 右侧主体 ---------------------------- */
.shell-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.shell-header {
  height: var(--ql-header-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--ql-s4) 0 var(--ql-s2);
  background: var(--ql-surface);
  /* 顶栏下沿与侧边栏 brand 下沿取同一条细描边，避免两条同高度横线颜色不一致而「断线」；
     顶栏（白）与主区（--ql-bg 灰）本身已有明度差分界，细线即可 */
  border-bottom: 1px solid var(--ql-border-light);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--ql-s1);
}

.collapse-btn {
  color: var(--ql-muted);
}

.collapse-btn:hover {
  color: var(--ql-primary);
  background: var(--ql-primary-soft);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--ql-s2);
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  cursor: pointer;
  outline: none;
  transition: background-color var(--ql-dur-fast) var(--ql-ease-spring);
}

.user-chip:hover {
  background: var(--ql-surface-sunken);
}

.user-avatar {
  background: var(--ql-primary-soft);
  color: var(--ql-primary);
  font-weight: 600;
  font-size: 13px;
}

.user-meta {
  line-height: 1.3;
}

.user-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--ql-fs-small);
  font-weight: 600;
  color: var(--ql-title);
}

.user-privacy {
  font-size: var(--ql-fs-tip);
  color: var(--ql-muted);
}

.user-caret {
  color: var(--ql-muted);
  font-size: 12px;
}

.icon-btn {
  color: var(--ql-text);
  padding: 6px;
}

.icon-btn:hover {
  color: var(--ql-primary);
  background: var(--ql-primary-soft);
}

.shell-main {
  flex: 1;
  overflow: auto;
  background: var(--ql-bg);
}
</style>
