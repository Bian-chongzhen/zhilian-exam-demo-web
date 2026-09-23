// 冒烟测试用的 localStorage 替身（必须在任何 mock 模块之前执行）
// 说明：Mock 层把数据存在 localStorage，Node 里没有这个对象，所以先打一个内存替身。
// 这样跑测试**不会**碰浏览器里的演示数据。
const store = new Map()

globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
}
