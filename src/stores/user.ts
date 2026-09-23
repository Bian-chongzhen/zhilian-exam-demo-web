import { defineStore } from 'pinia'
import { RoleType } from '@/constants/enums'
import { Identity } from '@/constants/identity'
import { api } from '@/api'
import type { SysUser } from '@/types/models'

/**
 * 用户会话 store
 * 对应设计文档：Redis Session 语义（Demo 用 localStorage 模拟），注销即会话失效。
 *
 * v0.5 变更（《13、知练题库 v0.5 需求规格文档.md》§2）：
 * 新增**运行时身份**判定 —— 游客 / 普通登录用户 / 管理员。
 * 游客只是会话状态（无 user 即游客），不落库、不新增数据库枚举；
 * `identity` 是全系统唯一的身份判定入口，页面禁止自行读取 roleType 拼装身份（§5.3 第 3 条）。
 */
export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as SysUser | null,
    token: null as string | null,
    loading: false,
    /**
     * 会话记录存在、但对应账号已失效（被注销）—— 用于区分「游客」与「登录已失效」（§6.3 PER-02）。
     * 两者都跳登录页，但登录页提示文案不同（固定文案见 `constants/copy.ts`）。
     */
    sessionExpired: false,
  }),

  getters: {
    /** 身份唯一判定入口：先看是否登录，再看角色 */
    identity: (state): Identity => {
      if (!state.user) return Identity.GUEST
      return state.user.roleType === RoleType.ADMIN ? Identity.ADMIN : Identity.USER
    },
    isLogin: (state) => !!state.user,
    isGuest: (state) => !state.user,
    isAdmin: (state) => state.user?.roleType === RoleType.ADMIN,
    userId: (state) => state.user?.id ?? 0,
    /**
     * 传给契约面的「查看者 id」：游客必须传 null，不能传 0。
     * 0 会被服务层当成一个不存在的用户 id，而不是「没有查看者」。
     */
    viewerId: (state): number | null => state.user?.id ?? null,
    displayName: (state) => state.user?.username ?? '游客',
  },

  actions: {
    async loadCurrent() {
      /**
       * 顺序很关键：先判断「会话存在但已失效」，再取当前用户。
       * 因为 current() 内部会把失效会话清掉（对应 Q19 决策），之后就无法再区分
       * 「从未登录的游客」与「登录已失效」了。
       */
      const expired = await api.auth.isSessionExpired()
      this.user = await api.auth.current()
      this.sessionExpired = !this.user && expired
      return this.user
    },

    async login(params: Parameters<typeof api.auth.login>[0]) {
      this.loading = true
      try {
        const result = await api.auth.login(params)
        this.user = result.user
        this.token = result.token
        this.sessionExpired = false
        return result.user
      } finally {
        this.loading = false
      }
    },

    async register(params: Parameters<typeof api.auth.register>[0]) {
      this.loading = true
      try {
        return await api.auth.register(params)
      } finally {
        this.loading = false
      }
    },

    async logout() {
      await api.auth.logout()
      this.user = null
      this.token = null
      this.sessionExpired = false
    },

    async refresh() {
      this.user = await api.auth.current()
    },

    /** 注销账号后本地会话立即清空 */
    async deactivate(password: string) {
      if (!this.user) throw new Error('未登录')
      await api.user.deactivate(this.user.id, password)
      this.user = null
      this.token = null
      this.sessionExpired = false
    },

    /**
     * 只清空本地内存态，不调用后端。
     * 用于「服务端会话已失效但前端还持有用户」的场景（如找回密码重置成功），
     * 否则路由守卫会因为 userStore.user 仍非空而把 /login 弹回首页。
     */
    clearLocalSession() {
      this.user = null
      this.token = null
      this.sessionExpired = false
    },
  },
})
