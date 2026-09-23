<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Copy } from '@/constants/copy'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const mode = ref<'username' | 'phone'>('username')
const loading = ref(false)
const form = reactive({
  username: '',
  password: '',
  phone: '',
})

/**
 * 会话失效提示（13 号 §6.3 PER-02）
 * 守卫区分「游客主动访问需登录页面」与「登录已失效」两种情况，后者带 `expired=1` 过来。
 */
const sessionExpired = computed(() => route.query.expired === '1')

/** 游客在公开页触发写操作时会带 redirect 过来，这里提示一句「登录后回到原处」 */
const redirectTip = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect !== '/' ? redirect : ''
})

const demoAccounts = [
  { label: 'admin（管理员）', username: 'admin', password: '123456', desc: '可维护分类/标签、创建公开试卷' },
  { label: 'alice（有答题记录）', username: 'alice', password: '123456', desc: '错题次数累加、已掌握流转演示' },
  { label: 'bob（隐私主页）', username: 'bob', password: '123456', desc: '他人仅能看到其公开试卷' },
  { label: 'dave（新用户）', username: 'dave', password: '123456', desc: '无记录，用于验证未作答分类隐藏' },
]

function fill(account: { username: string; password: string }) {
  mode.value = 'username'
  form.username = account.username
  form.password = account.password
}

async function submit() {
  loading.value = true
  try {
    const user = await userStore.login({
      mode: mode.value,
      username: form.username,
      password: form.password,
      phone: form.phone,
    })
    ElMessage.success(`欢迎回来，${user.username}`)
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-brand">
        <div class="brand-logo">知</div>
        <div class="brand-text">
          <div class="brand-name">知练题库系统</div>
          <div class="brand-sub">Demo · 前端功能与项目需求验证</div>
        </div>
      </div>

      <el-tabs v-model="mode" class="auth-tabs">
        <el-tab-pane label="用户名登录" name="username" />
        <el-tab-pane label="手机号登录" name="phone" />
      </el-tabs>

      <!-- 会话失效：固定文案「登录已失效，请重新登录」（13 号 §9.5） -->
      <div v-if="sessionExpired" class="rule-tip warn mb16">{{ Copy.sessionExpired }}</div>
      <!-- 由游客写操作引导过来：说明登录后会回到原来的页面 -->
      <div v-else-if="redirectTip" class="rule-tip mb16">
        登录后将回到你刚才访问的页面，继续未完成的操作。
      </div>

      <el-form label-position="top" class="auth-form" @submit.prevent="submit">
        <el-form-item v-if="mode === 'phone'" label="手机号">
          <el-input v-model="form.phone" placeholder="手机号允许重复，需配合用户名定位账号" />
        </el-form-item>
        <el-form-item :label="mode === 'phone' ? '用户名（用于消除账号歧义）' : '用户名'">
          <el-input v-model="form.username" placeholder="请输入用户名" @keyup.enter="submit" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="密码无复杂度限制"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-button type="primary" class="submit-btn" :loading="loading" @click="submit">
          登 录
        </el-button>
      </el-form>

      <div class="auth-links">
        <router-link to="/register">注册新账号</router-link>
        <router-link to="/forgot">忘记密码</router-link>
      </div>

      <el-divider content-position="left" class="auth-divider">
        <span class="text-tip">演示账号（密码均为 123456）</span>
      </el-divider>
      <div class="demo-accounts">
        <div v-for="item in demoAccounts" :key="item.username" class="demo-account" @click="fill(item)">
          <div class="demo-label">{{ item.label }}</div>
          <div class="demo-desc">{{ item.desc }}</div>
        </div>
      </div>
      <div class="rule-tip mt16">
        另有已注销账号 <b>carol</b>：无法登录，但其历史答题记录、准确率与公开试卷仍可在主页查看并标注"已注销"。
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 独立全屏页：浅灰底 + 居中卡片 */
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  align-items: safe center; /* 内容超高时回退为顶部对齐，避免上沿被裁切 */
  justify-content: center;
  background: var(--ql-bg);
  padding: var(--ql-s5) var(--ql-s3);
}

.auth-card {
  width: 440px;
  background: var(--ql-surface);
  border: 1px solid var(--ql-border);
  border-radius: var(--ql-radius-lg);
  padding: var(--ql-s5);
  box-shadow: var(--ql-shadow-pop);
}

/* 品牌区：主色方块 logo + 名称 + 副标题 */
.auth-brand {
  display: flex;
  align-items: center;
  gap: var(--ql-s2);
  margin-bottom: var(--ql-s3);
}

.brand-logo {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--ql-radius-sm);
  background: var(--ql-primary-fill);
  /* 主色实心底上用近白文字（对比度 6.0:1） */
  color: var(--ql-on-primary);
  font-size: var(--ql-fs-section);
  font-weight: 600;
}

.brand-name {
  font-size: var(--ql-fs-page);
  font-weight: 600;
  color: var(--ql-title);
  letter-spacing: -0.01em;
  line-height: 1.4;
}

.brand-sub {
  font-size: var(--ql-fs-tip);
  color: var(--ql-muted);
  margin-top: 2px;
}

.auth-tabs {
  margin-bottom: var(--ql-s1);
}

.auth-tabs :deep(.el-tabs__header) {
  margin-bottom: var(--ql-s3);
}

.auth-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: var(--ql-border);
}

.auth-form :deep(.el-form-item) {
  margin-bottom: var(--ql-s3);
}

.submit-btn {
  width: 100%;
  height: 40px;
  margin-top: var(--ql-s1);
}

.auth-links {
  display: flex;
  justify-content: space-between;
  margin-top: var(--ql-s2);
  font-size: var(--ql-fs-small);
}

.auth-divider :deep(.el-divider__text) {
  background: var(--ql-surface);
  padding: 0 var(--ql-s1);
}

.demo-accounts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ql-s1);
}

.demo-account {
  border: 1px solid var(--ql-border);
  border-radius: var(--ql-radius-sm);
  padding: var(--ql-s1) 10px;
  cursor: pointer;
  background: var(--ql-surface);
  transition: background-color var(--ql-dur-fast) var(--ql-ease-spring),
    border-color var(--ql-dur-fast) var(--ql-ease-spring);
}

.demo-account:hover {
  border-color: var(--ql-primary);
  background: var(--ql-primary-soft);
}

.demo-label {
  font-size: var(--ql-fs-small);
  font-weight: 600;
  color: var(--ql-title);
}

.demo-desc {
  font-size: var(--ql-fs-tip);
  color: var(--ql-muted);
  margin-top: 2px;
  line-height: 1.5;
}
</style>
