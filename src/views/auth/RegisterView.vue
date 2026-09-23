<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const form = reactive({ username: '', password: '', confirm: '', phone: '' })
const loading = ref(false)
const nameState = ref<{ available: boolean; message: string } | null>(null)

async function checkName() {
  if (!form.username) {
    nameState.value = null
    return
  }
  nameState.value = await api.auth.checkUsername(form.username)
}

async function submit() {
  if (form.password !== form.confirm) {
    ElMessage.error('两次输入的密码不一致')
    return
  }
  loading.value = true
  try {
    await userStore.register({ username: form.username, password: form.password, phone: form.phone })
    ElMessage.success('注册成功，请登录')
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
          <div class="brand-name">注册新账号</div>
          <div class="brand-sub">用户名全局唯一；手机号必填、允许重复，仅校验格式</div>
        </div>
      </div>

      <el-form label-position="top" class="auth-form" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="2-50 字符，全局唯一" @blur="checkName">
            <template #suffix>
              <el-icon v-if="nameState?.available" color="var(--ql-success)"><Check /></el-icon>
              <el-icon v-else-if="nameState" color="var(--ql-danger)"><Close /></el-icon>
            </template>
          </el-input>
          <div v-if="nameState" class="hint" :class="nameState.available ? 'ok' : 'bad'">
            {{ nameState.message }}
          </div>
        </el-form-item>

        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="无复杂度与长度限制" />
        </el-form-item>

        <el-form-item label="确认密码">
          <el-input v-model="form.confirm" type="password" show-password />
        </el-form-item>

        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="11 位数字，仅用于找回密码" maxlength="11" />
          <div class="hint">注册阶段不校验手机号真伪、无需短信验证；仅作找回密码标识</div>
        </el-form-item>

        <el-button type="primary" class="submit-btn" :loading="loading" @click="submit">注 册</el-button>
      </el-form>

      <div class="auth-links">
        <router-link to="/login">已有账号，去登录</router-link>
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
  line-height: 1.6;
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
