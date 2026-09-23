<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const form = reactive({ phone: '', username: '', newPassword: '' })
const loading = ref(false)

async function submit() {
  loading.value = true
  try {
    await api.auth.resetPassword({ ...form })
    // Mock 层已让该账号在线会话失效（清 localStorage），这里同步清空内存态：
    // 否则已登录用户会被守卫判为"仍登录"，push('/login') 会被弹回首页
    userStore.clearLocalSession()
    ElMessage.success('密码已重置，且该账号所有在线会话已失效，请重新登录')
    router.push('/login')
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
          <div class="brand-name">找回密码</div>
          <div class="brand-sub">依托注册手机号找回，无短信验证</div>
        </div>
      </div>

      <div class="rule-tip warn mb24">
        手机号允许重复，因此找回需<b>手机号 + 用户名</b>二元匹配才能定位到唯一账号（对应设计决策 P0-9）。
      </div>

      <el-form label-position="top" class="auth-form" @submit.prevent="submit">
        <el-form-item label="注册手机号">
          <el-input v-model="form.phone" maxlength="11" placeholder="11 位数字" />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="用于消除账号歧义" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="form.newPassword" type="password" show-password />
          <div class="hint">重置成功后该账号的在线会话将全部失效，需重新登录</div>
        </el-form-item>
        <el-button type="primary" class="submit-btn" :loading="loading" @click="submit">
          重置密码
        </el-button>
      </el-form>

      <div class="auth-links">
        <router-link to="/login">返回登录</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 与登录页同一套卡片风格与宽度 */
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
  background: var(--ql-primary);
  color: var(--ql-surface);
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

.auth-form :deep(.el-form-item) {
  margin-bottom: var(--ql-s3);
}

.submit-btn {
  width: 100%;
  height: 40px;
  margin-top: var(--ql-s1);
}

.auth-links {
  margin-top: var(--ql-s2);
  font-size: var(--ql-fs-small);
}
</style>
