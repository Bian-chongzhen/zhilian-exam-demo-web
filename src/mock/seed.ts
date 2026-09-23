import {
  DraftSourceType,
  DraftStatus,
  ExamSourceType,
  FavoriteTargetType,
  FeedbackStatus,
  JudgeResult,
  JudgeStatus,
  MasterStatus,
  PaperType,
  PrivacyType,
  QuestionType,
  RoleType,
  TitleFormat,
  Visibility,
} from '@/constants/enums'
import type {
  CategoryScoreWeight,
  CategoryTagRel,
  DraftQuestionRel,
  Favorite,
  FeedbackTicket,
  Knowledge,
  KnowledgeAnnotation,
  KnowledgeQuestionRel,
  KnowledgeTagRel,
  PaperCategory,
  PaperDraft,
  PaperExam,
  PaperExamQuestion,
  Question,
  QuestionNote,
  QuestionTag,
  QuestionTagRel,
  SysUser,
  UserQuestionRecord,
  UserWrongDetail,
} from '@/types/models'
import type { MockDb, MockTables } from './db'
import { JUDGE_OPTIONS, judgeObjective, parseOptions, splitMulti } from './rules/judge'
import { DEMO_PASSWORD, hashPassword } from './rules/password'

/**
 * 假数据种子
 * 说明：答题记录的判分结果由 rules/judge.ts 的真实判分函数推导，
 * 保证种子数据与运行时规则完全自洽（不会出现"演示数据与规则打架"）。
 */

const now = new Date()
const daysAgo = (days: number, hour = 10): string => {
  const d = new Date(now.getTime() - days * 24 * 3600 * 1000)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
const minutesAgo = (m: number): string => new Date(now.getTime() - m * 60 * 1000).toISOString()

export function buildSeed(): MockDb {
  const seq: Record<string, number> = {}
  const id = (table: keyof MockTables | string): number => {
    seq[table] = (seq[table] ?? 0) + 1
    return seq[table]
  }
  const base = (table: string) => ({ id: id(table), deleted: 0, createTime: daysAgo(90), updateTime: daysAgo(90) })

  /* ----------------------------- 用户 ----------------------------- */
  const users: SysUser[] = []
  const addUser = (
    username: string,
    phone: string,
    roleType: RoleType,
    privacyType: PrivacyType,
    profile: string,
    deleted = 0,
  ): SysUser => {
    const user: SysUser = {
      ...base('users'),
      username,
      password: hashPassword(DEMO_PASSWORD),
      phone,
      roleType,
      profile,
      privacyType,
      lastLoginTime: daysAgo(1),
      deleted,
      deleteTime: deleted ? daysAgo(30) : null,
    }
    users.push(user)
    return user
  }

  const admin = addUser(
    'admin',
    '13800000001',
    RoleType.ADMIN,
    PrivacyType.PUBLIC,
    '系统管理员，负责维护全局试卷分类、考点标签与公开试卷。',
  )
  const alice = addUser(
    'alice',
    '13800000002',
    RoleType.USER,
    PrivacyType.PUBLIC,
    '备考软考程序员，正在刷上午客观题与面试八股。',
  )
  const bob = addUser(
    'bob',
    '13800000003',
    RoleType.USER,
    PrivacyType.PRIVATE,
    '隐私主页示例账号：他人只能看到我发布的公开试卷。',
  )
  const carol = addUser(
    'carol',
    '13800000004',
    RoleType.USER,
    PrivacyType.PUBLIC,
    '已注销账号示例：主页仍展示历史答题记录并标注"该用户已注销"。',
    1,
  )
  addUser(
    'dave',
    '13800000005',
    RoleType.USER,
    PrivacyType.PRIVATE,
    '新用户示例：暂无任何答题记录，用于验证"未作答分类自动隐藏"。',
  )

  /* --------------------------- 考点标签 --------------------------- */
  const tagNames = [
    '计算机基础',
    '进制转换',
    '数据结构',
    '程序流程图',
    '操作系统',
    '计算机网络',
    '算法设计',
    '数据库设计',
    '系统设计',
    'Java基础',
    '并发编程',
    'JVM',
    'MySQL索引',
    'Redis缓存',
  ]
  const tags: QuestionTag[] = tagNames.map((tagName, index) => ({
    ...base('tags'),
    tagName,
    isEnabled: 1,
    sortNo: index + 1,
  }))
  const tagId = (name: string): number => tags.find((t) => t.tagName === name)!.id

  /* --------------------------- 试卷分类 --------------------------- */
  const categories: PaperCategory[] = []
  const addCategory = (
    categoryName: string,
    fixedQuestionCount: number,
    isSystem: number,
    sortNo: number,
  ): PaperCategory => {
    const category: PaperCategory = {
      ...base('categories'),
      categoryName,
      fixedQuestionCount,
      isSystem,
      sortNo,
    }
    categories.push(category)
    return category
  }

  const catMorning = addCategory('上午客观题', 10, 1, 1)
  const catAfternoon = addCategory('下午主观题', 3, 1, 2)
  const catInterview = addCategory('面试八股', 8, 0, 3)

  const categoryTagRels: CategoryTagRel[] = []
  const linkCategoryTag = (categoryId: number, names: string[]): void => {
    names.forEach((n) => {
      categoryTagRels.push({
        ...base('categoryTagRels'),
        categoryId,
        tagId: tagId(n),
      })
    })
  }
  linkCategoryTag(catMorning.id, ['计算机基础', '进制转换', '数据结构', '程序流程图', '操作系统', '计算机网络'])
  linkCategoryTag(catAfternoon.id, ['算法设计', '数据库设计', '系统设计'])
  linkCategoryTag(catInterview.id, ['Java基础', '并发编程', 'JVM', 'MySQL索引', 'Redis缓存'])

  const categoryWeights: CategoryScoreWeight[] = []
  const addWeight = (categoryId: number, tagName: string, weight: number): void => {
    categoryWeights.push({
      ...base('categoryWeights'),
      categoryId,
      tagId: tagId(tagName),
      weight,
    })
  }
  // 上午客观题：部分标签配置了权重；「计算机网络」刻意不配置，用于验证"未配置按均权"
  addWeight(catMorning.id, '计算机基础', 2.0)
  addWeight(catMorning.id, '进制转换', 1.5)
  addWeight(catMorning.id, '数据结构', 1.5)
  addWeight(catMorning.id, '程序流程图', 1.0)
  addWeight(catMorning.id, '操作系统', 1.0)
  // 面试八股：Redis缓存 刻意不配置
  addWeight(catInterview.id, 'Java基础', 2.0)
  addWeight(catInterview.id, '并发编程', 1.5)
  addWeight(catInterview.id, 'JVM', 1.2)
  addWeight(catInterview.id, 'MySQL索引', 1.0)
  // 下午主观题：全部不配置 → 全均权

  /* ----------------------------- 题目 ----------------------------- */
  const questions: Question[] = []
  const questionTagRels: QuestionTagRel[] = []

  const addQuestion = (opts: {
    type: QuestionType
    title: string
    options?: Array<{ key: string; content: string }>
    answer: string
    analysis: string
    score: number
    tags: string[]
  }): Question => {
    const question: Question = {
      ...base('questions'),
      questionType: opts.type,
      title: opts.title,
      titleFormat: TitleFormat.PLAIN,
      options:
        opts.type === QuestionType.SHORT_ANSWER
          ? null
          : JSON.stringify(
              opts.options ??
                (opts.type === QuestionType.JUDGE ? JUDGE_OPTIONS : []),
            ),
      answer: opts.answer,
      analysis: opts.analysis,
      score: opts.score,
      isLocked: 0,
    }
    questions.push(question)
    opts.tags.forEach((t) => {
      questionTagRels.push({
        ...base('questionTagRels'),
        questionId: question.id,
        tagId: tagId(t),
      })
    })
    return question
  }

  const abc = (a: string, b: string, c: string, d: string) => [
    { key: 'A', content: a },
    { key: 'B', content: b },
    { key: 'C', content: c },
    { key: 'D', content: d },
  ]

  // —— 上午客观题 ——
  const q1 = addQuestion({
    type: QuestionType.SINGLE,
    title: '下列关于冯·诺依曼体系结构基本思想的描述，正确的是：',
    options: abc(
      '程序与数据分开存储，分别处理',
      '程序与数据统一存储，均以二进制形式表示',
      '指令与数据必须同时读入 CPU',
      '存储器按内容寻址而非按地址寻址',
    ),
    answer: 'B',
    analysis: '冯·诺依曼结构的核心是"存储程序"思想：程序与数据统一存放于存储器中，均以二进制表示。',
    score: 1,
    tags: ['计算机基础'],
  })
  const q2 = addQuestion({
    type: QuestionType.SINGLE,
    title: '二进制数 1101 0110 转换为十六进制是：',
    options: abc('D6', 'C6', 'E6', 'B6'),
    answer: 'A',
    analysis: '自右向左每 4 位一组：1101=D，0110=6，故为 D6。',
    score: 1,
    tags: ['进制转换'],
  })
  const q3 = addQuestion({
    type: QuestionType.SINGLE,
    title: '十进制数 45 转换为二进制数是：',
    options: abc('101101', '101011', '110101', '100101'),
    answer: 'A',
    analysis: '45 = 32+8+4+1 = 101101B。',
    score: 1,
    tags: ['进制转换'],
  })
  const q4 = addQuestion({
    type: QuestionType.SINGLE,
    title: '在长度为 n 的顺序表中插入一个元素，平均需要移动的元素个数约为：',
    options: abc('n/2', 'n', '(n+1)/2', 'n-1'),
    answer: 'A',
    analysis: '插入位置等概率分布，平均移动 n/2 个元素；若按最坏情况则为 n。',
    score: 1,
    tags: ['数据结构'],
  })
  const q5 = addQuestion({
    type: QuestionType.SINGLE,
    title: '具有 3 个结点的二叉树，共有多少种不同的形态？',
    options: abc('3', '5', '8', '9'),
    answer: 'B',
    analysis: '卡特兰数 C(2n,n)/(n+1)，n=3 时为 5 种。',
    score: 1,
    tags: ['数据结构'],
  })
  const q6 = addQuestion({
    type: QuestionType.SINGLE,
    title: '进程与程序的主要区别是：',
    options: abc(
      '进程是静态的，程序是动态的',
      '进程是动态的，程序是静态的',
      '二者没有任何区别',
      '程序一定比进程占用更多内存',
    ),
    answer: 'B',
    analysis: '程序是静态的指令集合，进程是程序的一次执行过程，具有动态性、并发性与独立性。',
    score: 1,
    tags: ['操作系统'],
  })
  const q7 = addQuestion({
    type: QuestionType.SINGLE,
    title: 'TCP 三次握手中，第二次握手报文中携带的标志位是：',
    options: abc('仅 SYN', 'SYN + ACK', '仅 ACK', 'FIN'),
    answer: 'B',
    analysis: '第二次握手服务端同时确认客户端序列号并发送自己的序列号，故为 SYN+ACK。',
    score: 1,
    tags: ['计算机网络'],
  })
  const q14 = addQuestion({
    type: QuestionType.SINGLE,
    title: '程序流程图中，用于表示"开始 / 结束"的图形是：',
    options: abc('矩形', '菱形', '圆角矩形（椭圆）', '平行四边形'),
    answer: 'C',
    analysis: '圆角矩形表示起止；矩形表示处理；菱形表示判断；平行四边形表示输入输出。',
    score: 1,
    tags: ['程序流程图'],
  })
  const q8 = addQuestion({
    type: QuestionType.MULTIPLE,
    title: '下列属于计算机系统软件的有：',
    options: abc('操作系统', '编译程序', '数据库管理系统', '文字处理软件'),
    answer: 'A,B,C',
    analysis: '系统软件包括操作系统、编译程序、数据库管理系统等；文字处理软件属于应用软件。',
    score: 2,
    tags: ['计算机基础'],
  })
  const q9 = addQuestion({
    type: QuestionType.MULTIPLE,
    title: '下列排序算法中，平均时间复杂度为 O(n log n) 的有：',
    options: abc('快速排序', '归并排序', '堆排序', '冒泡排序'),
    answer: 'A,B,C',
    analysis: '冒泡排序平均时间复杂度为 O(n²)。',
    score: 2,
    tags: ['数据结构'],
  })
  const q10 = addQuestion({
    type: QuestionType.MULTIPLE,
    title: '产生死锁的必要条件包括：',
    options: abc('互斥条件', '请求与保持条件', '不可剥夺条件', '循环等待条件'),
    answer: 'A,B,C,D',
    analysis: '四个条件同时满足才可能产生死锁，缺一不可。',
    score: 2,
    tags: ['操作系统'],
  })
  const q11 = addQuestion({
    type: QuestionType.JUDGE,
    title: '判断：计算机中浮点数的表示可能存在精度误差。',
    answer: '1',
    analysis: '浮点数采用有限位二进制表示，无法精确表示所有十进制小数，因此存在精度误差。',
    score: 1,
    tags: ['计算机基础'],
  })
  const q12 = addQuestion({
    type: QuestionType.JUDGE,
    title: '判断：程序流程图中，菱形框用于表示处理步骤。',
    answer: '0',
    analysis: '菱形框表示判断（条件分支），矩形框才表示处理步骤。',
    score: 1,
    tags: ['程序流程图'],
  })
  const q13 = addQuestion({
    type: QuestionType.JUDGE,
    title: '判断：HTTPS 协议的默认端口号为 443。',
    answer: '1',
    analysis: 'HTTPS 默认端口 443，HTTP 默认端口 80。',
    score: 1,
    tags: ['计算机网络'],
  })

  // —— 面试八股 ——
  const q15 = addQuestion({
    type: QuestionType.SINGLE,
    title: '下列哪一项不属于 Java 的基本数据类型？',
    options: abc('int', 'boolean', 'String', 'char'),
    answer: 'C',
    analysis: 'String 是引用类型（类），Java 的 8 种基本类型不含 String。',
    score: 1,
    tags: ['Java基础'],
  })
  const q16 = addQuestion({
    type: QuestionType.SINGLE,
    title: '下列关于 Java String 的描述，正确的是：',
    options: abc(
      'String 是可变对象，修改内容不会创建新对象',
      'String 对象创建后其内容不可变',
      'String 可以直接用 == 比较内容是否相同',
      'String 不是 final 类，可以被继承',
    ),
    answer: 'B',
    analysis: 'String 被 final 修饰、内部字符数组不可变；内容比较应使用 equals。',
    score: 1,
    tags: ['Java基础'],
  })
  const q17 = addQuestion({
    type: QuestionType.SINGLE,
    title: 'JVM 运行时数据区中，属于线程私有的区域是：',
    options: abc('方法区', '堆', '虚拟机栈', '元空间'),
    answer: 'C',
    analysis: '虚拟机栈、本地方法栈、程序计数器为线程私有；堆与方法区（元空间）为线程共享。',
    score: 1,
    tags: ['JVM'],
  })
  const q18 = addQuestion({
    type: QuestionType.SINGLE,
    title: '下列 Java 引用类型中，最不容易被垃圾回收器回收的是：',
    options: abc('强引用', '软引用', '弱引用', '虚引用'),
    answer: 'A',
    analysis: '强引用只要可达就不会被回收；软引用在内存不足时回收；弱引用在下次 GC 时回收。',
    score: 1,
    tags: ['JVM'],
  })
  const q19 = addQuestion({
    type: QuestionType.SINGLE,
    title: 'Java 中 volatile 关键字的作用是：',
    options: abc(
      '保证变量的原子性',
      '保证变量的可见性与禁止指令重排序',
      '替代 synchronized 实现互斥',
      '保证复合操作的线程安全',
    ),
    answer: 'B',
    analysis: 'volatile 保证可见性与有序性，但不保证原子性（如 i++ 仍需加锁）。',
    score: 1,
    tags: ['并发编程'],
  })
  const q20 = addQuestion({
    type: QuestionType.SINGLE,
    title: '关于 synchronized 与 ReentrantLock，下列说法正确的是：',
    options: abc(
      'synchronized 支持响应中断',
      'ReentrantLock 支持公平锁',
      '两者都不支持可重入',
      'ReentrantLock 无需手动释放锁',
    ),
    answer: 'B',
    analysis: 'ReentrantLock 可构造公平锁，且支持中断、超时与多条件变量；但必须手动 unlock。',
    score: 1,
    tags: ['并发编程'],
  })
  const q21 = addQuestion({
    type: QuestionType.SINGLE,
    title: 'InnoDB 中的聚簇索引是指：',
    options: abc(
      '以主键顺序组织数据存储的索引，叶子节点存放整行数据',
      '以非主键列组织数据存储的索引',
      '基于哈希表实现的索引',
      '用于全文检索的索引',
    ),
    answer: 'A',
    analysis: 'InnoDB 主键索引即聚簇索引，叶子节点存储完整行数据；二级索引叶子存储主键值。',
    score: 1,
    tags: ['MySQL索引'],
  })
  const q22 = addQuestion({
    type: QuestionType.SINGLE,
    title: '下列哪种写法最可能导致 MySQL 无法使用索引？',
    options: abc(
      '在索引列上使用函数，如 WHERE YEAR(create_time) = 2024',
      '使用等值查询 WHERE user_id = 1',
      '遵循最左前缀原则查询联合索引',
      '使用覆盖索引避免回表',
    ),
    answer: 'A',
    analysis: '对索引列使用函数会导致索引失效，应改写为范围查询。',
    score: 1,
    tags: ['MySQL索引'],
  })
  const q23 = addQuestion({
    type: QuestionType.MULTIPLE,
    title: '关于 Redis 持久化机制，下列说法正确的有：',
    options: abc(
      'RDB 是以快照方式保存某一时刻的数据',
      'AOF 记录的是写命令',
      'RDB 的恢复速度通常快于 AOF',
      'AOF 文件体积一定小于 RDB 文件',
    ),
    answer: 'A,B,C',
    analysis: 'AOF 记录写命令，文件通常比 RDB 更大，但数据丢失更少。',
    score: 2,
    tags: ['Redis缓存'],
  })
  const q24 = addQuestion({
    type: QuestionType.MULTIPLE,
    title: '关于 Java 线程池，下列说法正确的有：',
    options: abc(
      '核心线程数已满时，新任务会先进入工作队列',
      '线程池可以降低线程频繁创建销毁的开销',
      '线程池的线程数配置得越大性能越好',
      '线程池可以统一管理线程的生命周期',
    ),
    answer: 'A,B,D',
    analysis: '线程数过大会加剧上下文切换与资源竞争，需结合任务类型与 CPU 核数合理配置。',
    score: 2,
    tags: ['并发编程'],
  })
  const q25 = addQuestion({
    type: QuestionType.JUDGE,
    title: '判断：Java 中使用 == 比较两个引用类型变量时，比较的是对象的内存地址。',
    answer: '1',
    analysis: '== 比较引用地址（是否同一对象）；内容比较应使用 equals。',
    score: 1,
    tags: ['Java基础'],
  })
  const q26 = addQuestion({
    type: QuestionType.JUDGE,
    title: '判断：Redis 采用单线程模型处理命令，因此不存在任何并发问题。',
    answer: '0',
    analysis: 'Redis 命令执行是单线程的，但业务层仍存在并发竞争（如缓存击穿、超卖），需要额外控制。',
    score: 1,
    tags: ['Redis缓存'],
  })

  // —— 下午主观题（简答题：v1 不判分，交卷后展示参考答案供自评） ——
  const q27 = addQuestion({
    type: QuestionType.SHORT_ANSWER,
    title: '请简述快速排序的基本思想，并说明其最坏时间复杂度及产生原因。',
    answer:
      '快速排序采用分治思想：选取一个基准元素，将序列划分为小于基准与大于基准的两部分，再递归处理两部分。平均时间复杂度 O(n log n)；当每次划分极不平衡（例如序列已基本有序且固定取首元素为基准）时，递归深度退化为 n，最坏时间复杂度为 O(n²)。',
    analysis: '答题要点：分治思想、基准选取与划分过程、平均 O(n log n)、最坏 O(n²) 及产生条件（划分不平衡）。',
    score: 5,
    tags: ['算法设计'],
  })
  const q28 = addQuestion({
    type: QuestionType.SHORT_ANSWER,
    title: '请设计算法判断单链表中是否存在环，并说明时间复杂度与空间复杂度。',
    answer:
      '可采用快慢指针（Floyd 判圈算法）：慢指针每次走 1 步，快指针每次走 2 步，若存在环则两指针必然在环内相遇，若快指针到达链表末尾则无环。时间复杂度 O(n)，空间复杂度 O(1)。也可用哈希表记录访问过的结点，时间 O(n)、空间 O(n)。',
    analysis: '答题要点：快慢指针思路、相遇判定条件、O(n) 时间与 O(1) 空间；提及哈希表方案可加分。',
    score: 5,
    tags: ['算法设计'],
  })
  const q29 = addQuestion({
    type: QuestionType.SHORT_ANSWER,
    title: '请说明数据库三大范式的内容，并举例说明何时需要反范式设计。',
    answer:
      '第一范式（1NF）：字段具有原子性，不可再分；第二范式（2NF）：在 1NF 基础上消除非主属性对主键的部分依赖；第三范式（3NF）：在 2NF 基础上消除非主属性对主键的传递依赖。反范式场景：读多写少、联表查询代价高的统计报表场景，可冗余部分字段以减少 join；或为了保留历史快照（如订单中的商品价格）而刻意冗余。',
    analysis: '答题要点：三范式定义准确 + 反范式动机（性能换冗余、快照留存）与代价（一致性维护成本）。',
    score: 5,
    tags: ['数据库设计'],
  })
  const q30 = addQuestion({
    type: QuestionType.SHORT_ANSWER,
    title: '请简述缓存穿透、缓存击穿与缓存雪崩的区别及各自的解决方案。',
    answer:
      '缓存穿透：查询不存在的数据，请求绕过缓存直达数据库。方案：布隆过滤器、空值缓存。缓存击穿：某个热点 key 失效瞬间大量并发请求打到数据库。方案：互斥锁重建、热点数据永不过期 + 异步更新。缓存雪崩：大量 key 同时失效或缓存服务宕机，导致数据库压力骤增。方案：过期时间加随机抖动、多级缓存、缓存集群高可用与限流降级。',
    analysis: '答题要点：三者定义区分清楚（不存在的数据 / 单个热点 key / 大面积同时失效）+ 对应方案匹配。',
    score: 5,
    tags: ['系统设计'],
  })
  const q31 = addQuestion({
    type: QuestionType.SHORT_ANSWER,
    title: '请说明 CAP 理论的含义，并举例说明分布式系统中的取舍。',
    answer:
      'CAP 指一致性（Consistency）、可用性（Availability）、分区容错性（Partition tolerance）。分布式系统中分区容错性通常必须保留，因此实际是在 C 与 A 之间取舍：CP 系统（如 ZooKeeper、etcd）在网络分区时优先保证一致性，可能拒绝服务；AP 系统（如 Eureka、Cassandra）优先保证可用性，允许返回可能过期的数据。BASE 理论是对 AP 的延伸实践。',
    analysis: '答题要点：三者定义、P 必须保留的原因、CP 与 AP 的典型系统举例、可补充 BASE 理论。',
    score: 5,
    tags: ['系统设计'],
  })

  /* ----------------------------- 试卷 ----------------------------- */
  const drafts: PaperDraft[] = []
  const draftQuestionRels: DraftQuestionRel[] = []

  const addDraft = (opts: {
    draftName: string
    userId: number
    categoryId: number
    paperType: PaperType
    visibility: Visibility
    draftStatus: DraftStatus
    sourceType?: DraftSourceType
    randomOrder?: number
    questions: Array<{ q: Question; score?: number }>
    createTime?: string
  }): PaperDraft => {
    const locked = opts.draftStatus === DraftStatus.ENABLED ? 1 : 0
    const stampTime = opts.createTime ?? daysAgo(80)
    const draft: PaperDraft = {
      id: id('drafts'),
      deleted: 0,
      createTime: stampTime,
      updateTime: stampTime,
      draftName: opts.draftName,
      userId: opts.userId,
      categoryId: opts.categoryId,
      paperType: opts.paperType,
      visibility: opts.visibility,
      draftStatus: opts.draftStatus,
      isLocked: locked,
      sourceType: opts.sourceType ?? DraftSourceType.MANUAL,
      randomOrder: opts.randomOrder ?? 0,
      questionCount: opts.questions.length,
      enableTime: locked ? daysAgo(70) : null,
    }
    drafts.push(draft)
    opts.questions.forEach((item, index) => {
      draftQuestionRels.push({
        id: id('draftQuestionRels'),
        deleted: 0,
        createTime: stampTime,
        updateTime: stampTime,
        draftId: draft.id,
        questionId: item.q.id,
        sortNo: index + 1,
        score: item.score ?? item.q.score,
      })
    })
    return draft
  }

  const d1 = addDraft({
    draftName: '软考程序员 · 上午客观题精选（14 题）',
    userId: admin.id,
    categoryId: catMorning.id,
    paperType: PaperType.COMPETITIVE,
    visibility: Visibility.PUBLIC,
    draftStatus: DraftStatus.ENABLED,
    questions: [q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14].map((q) => ({ q })),
  })
  const d2 = addDraft({
    draftName: '面试八股 · Java 核心与中间件（12 题）',
    userId: admin.id,
    categoryId: catInterview.id,
    paperType: PaperType.PRACTICE,
    visibility: Visibility.PUBLIC,
    draftStatus: DraftStatus.ENABLED,
    randomOrder: 1,
    questions: [q15, q16, q17, q18, q19, q20, q21, q22, q23, q24, q25, q26].map((q) => ({ q })),
  })
  const d3 = addDraft({
    draftName: '下午主观题 · 系统设计专项（5 题 · 简答自评）',
    userId: admin.id,
    categoryId: catAfternoon.id,
    paperType: PaperType.COMPETITIVE,
    visibility: Visibility.PUBLIC,
    draftStatus: DraftStatus.ENABLED,
    questions: [q27, q28, q29, q30, q31].map((q) => ({ q })),
  })
  const d4 = addDraft({
    draftName: '我的错题复习卷（第 1 次组卷）',
    userId: alice.id,
    categoryId: catMorning.id,
    paperType: PaperType.PRACTICE,
    visibility: Visibility.PRIVATE,
    draftStatus: DraftStatus.ENABLED,
    sourceType: DraftSourceType.WRONG_COMPOSE,
    questions: [q3, q8, q11, q13].map((q) => ({ q })),
    createTime: daysAgo(12),
  })
  // 该试卷引用了已被锁定试卷引用的题目 → 用于演示"题目继承锁定后只读"
  const d5 = addDraft({
    draftName: '待完善的私有练习卷（可编辑演示）',
    userId: alice.id,
    categoryId: catInterview.id,
    paperType: PaperType.PRACTICE,
    visibility: Visibility.PRIVATE,
    draftStatus: DraftStatus.DISABLED,
    questions: [{ q: q15 }, { q: q17 }],
    createTime: daysAgo(6),
  })
  addDraft({
    draftName: '旧版面试练习卷（已废弃）',
    userId: bob.id,
    categoryId: catInterview.id,
    paperType: PaperType.PRACTICE,
    visibility: Visibility.PRIVATE,
    draftStatus: DraftStatus.DISCARDED,
    questions: [{ q: q21 }, { q: q22 }],
    createTime: daysAgo(60),
  })

  // 锁定三件套之②：被已锁定试卷引用的题目继承锁定
  const lockedDraftIds = new Set(
    drafts.filter((d) => d.isLocked === 1 && d.draftStatus !== DraftStatus.DISCARDED).map((d) => d.id),
  )
  const questionIdSet = new Set(
    draftQuestionRels.filter((rel) => lockedDraftIds.has(rel.draftId)).map((rel) => rel.questionId),
  )
  questions.forEach((q) => {
    if (questionIdSet.has(q.id)) q.isLocked = 1
  })

  /* --------------------------- 答题记录 --------------------------- */
  const exams: PaperExam[] = []
  const examQuestions: PaperExamQuestion[] = []
  const records: UserQuestionRecord[] = []
  const wrongDetails: UserWrongDetail[] = []

  const findRecord = (userId: number, questionId: number, categoryId: number) =>
    records.find(
      (r) => r.userId === userId && r.questionId === questionId && r.categoryId === categoryId,
    )

  /** 构造一个错误答案（保证与参考答案确实不同） */
  const wrongAnswerOf = (question: Question): string => {
    if (question.questionType === QuestionType.JUDGE) {
      return question.answer === '1' ? '0' : '1'
    }
    if (question.questionType === QuestionType.MULTIPLE) {
      const keys = splitMulti(question.answer)
      return keys.slice(0, Math.max(1, keys.length - 1)).join(',') // 漏选 → 判错
    }
    const options = parseOptions(question.options)
    const correct = question.answer.trim().toUpperCase()
    const other = options.find((o) => o.key.toUpperCase() !== correct)
    return other ? other.key : 'A'
  }

  const simulateExam = (opts: {
    userId: number
    draft: PaperDraft
    submitTime: string
    sourceType?: ExamSourceType
    /** 答错的题目 id 列表；其余客观题答对 */
    wrongQuestionIds?: number[]
    /** 简答题的作答内容 */
    shortAnswers?: Record<number, string>
    /** 未交卷：只作答部分题目 */
    partial?: Record<number, string | null>
    usedSeconds?: number
  }): PaperExam => {
    const wrongIds = opts.wrongQuestionIds ?? []
    const rels = draftQuestionRels
      .filter((rel) => rel.draftId === opts.draft.id)
      .sort((a, b) => a.sortNo - b.sortNo)
    const attemptNo =
      exams.filter((e) => e.userId === opts.userId && e.draftId === opts.draft.id).length + 1
    const created = new Date(new Date(opts.submitTime).getTime() - 20 * 60 * 1000).toISOString()

    const exam: PaperExam = {
      id: id('exams'),
      deleted: 0,
      createTime: created,
      updateTime: opts.submitTime,
      userId: opts.userId,
      draftId: opts.draft.id,
      draftName: opts.draft.draftName,
      categoryId: opts.draft.categoryId,
      paperType: opts.draft.paperType,
      sourceType: opts.sourceType ?? ExamSourceType.NORMAL,
      attemptNo,
      questionCount: rels.length,
      totalScore: 0,
      obtainedScore: 0,
      usedSeconds: opts.usedSeconds ?? 600,
      submitTime: opts.submitTime,
    }
    exams.push(exam)

    let totalScore = 0
    let obtainedScore = 0

    rels.forEach((rel, index) => {
      const question = questions.find((q) => q.id === rel.questionId)!
      let userAnswer: string | null

      if (opts.partial) {
        userAnswer = opts.partial[question.id] ?? null
      } else if (question.questionType === QuestionType.SHORT_ANSWER) {
        userAnswer = opts.shortAnswers?.[question.id] ?? null
      } else if (wrongIds.includes(question.id)) {
        userAnswer = wrongAnswerOf(question)
      } else {
        userAnswer = question.answer
      }

      const isShort = question.questionType === QuestionType.SHORT_ANSWER
      const judged = !isShort && !opts.partial
      const result = judged
        ? judgeObjective(question.questionType, question.answer, userAnswer)
        : (null as JudgeResult | null)

      totalScore += rel.score
      if (result === JudgeResult.RIGHT) obtainedScore += rel.score

      examQuestions.push({
        id: id('examQuestions'),
        deleted: 0,
        createTime: created,
        updateTime: opts.submitTime,
        examId: exam.id,
        questionId: question.id,
        sortNo: index + 1,
        questionType: question.questionType,
        score: rel.score,
        userAnswer,
        judgeStatus: judged ? JudgeStatus.JUDGED : JudgeStatus.PENDING,
        judgeResult: result,
        obtainedScore: result === JudgeResult.RIGHT ? rel.score : result === JudgeResult.WRONG ? 0 : null,
        aiExplain: null,
        aiRetryTimes: 0,
        manualRetryTimes: 0,
        judgeTime: judged ? opts.submitTime : null,
      })
    })

    exam.totalScore = totalScore
    exam.obtainedScore = opts.partial ? null : Number(obtainedScore.toFixed(2))
    if (opts.partial) exam.submitTime = null

    // 错题记账（对应设计文档 6.2 节第 4 条）
    if (!opts.partial) {
      examQuestions
        .filter((eq) => eq.examId === exam.id)
        .forEach((eq) => {
          if (eq.judgeStatus !== JudgeStatus.JUDGED) return
          if (eq.judgeResult === JudgeResult.WRONG) {
            let record = findRecord(opts.userId, eq.questionId, exam.categoryId)
            if (!record) {
              record = {
                id: id('records'),
                deleted: 0,
                createTime: opts.submitTime,
                updateTime: opts.submitTime,
                userId: opts.userId,
                questionId: eq.questionId,
                categoryId: exam.categoryId,
                isMaster: MasterStatus.WRONG_SET,
                wrongCount: 1,
                lastExamId: exam.id,
                lastExamQuestionId: eq.id,
                lastWrongTime: opts.submitTime,
                masterTime: null,
              }
              records.push(record)
            } else {
              record.isMaster = MasterStatus.WRONG_SET
              record.wrongCount += 1
              record.lastExamId = exam.id
              record.lastExamQuestionId = eq.id
              record.lastWrongTime = opts.submitTime
              record.masterTime = null
              record.updateTime = opts.submitTime
            }
            wrongDetails.push({
              id: id('wrongDetails'),
              deleted: 0,
              createTime: opts.submitTime,
              updateTime: opts.submitTime,
              recordId: record.id,
              examId: exam.id,
              examQuestionId: eq.id,
              userAnswer: eq.userAnswer ?? null,
              judgeResult: eq.judgeResult ?? null,
              aiExplain: null,
              answerTime: opts.submitTime,
            })
          } else if (eq.judgeResult === JudgeResult.RIGHT) {
            const record = findRecord(opts.userId, eq.questionId, exam.categoryId)
            if (record && record.isMaster === MasterStatus.WRONG_SET) {
              record.isMaster = MasterStatus.MASTERED_SET
              record.masterTime = opts.submitTime
              record.lastExamId = exam.id
              record.lastExamQuestionId = eq.id
              record.updateTime = opts.submitTime
            }
          }
        })
    }

    return exam
  }

  // alice 在《上午客观题》上的三次作答，形成错题次数累加与"已掌握 → 再答错回错题"的完整轨迹
  simulateExam({
    userId: alice.id,
    draft: d1,
    submitTime: daysAgo(30),
    wrongQuestionIds: [q3, q8, q11, q13].map((q) => q.id),
    usedSeconds: 720,
  })
  simulateExam({
    userId: alice.id,
    draft: d1,
    submitTime: daysAgo(20),
    wrongQuestionIds: [q8, q13].map((q) => q.id),
    usedSeconds: 640,
  })
  simulateExam({
    userId: alice.id,
    draft: d1,
    submitTime: daysAgo(10),
    wrongQuestionIds: [q8, q11].map((q) => q.id),
    usedSeconds: 700,
  })
  // alice 在《面试八股》上的一次作答
  simulateExam({
    userId: alice.id,
    draft: d2,
    submitTime: daysAgo(5),
    wrongQuestionIds: [q18, q23, q24].map((q) => q.id),
    usedSeconds: 900,
  })
  // alice 的错题组卷答题记录（二刷）
  simulateExam({
    userId: alice.id,
    draft: d4,
    submitTime: daysAgo(2),
    sourceType: ExamSourceType.WRONG_COMPOSE,
    wrongQuestionIds: [q8, q13].map((q) => q.id),
    usedSeconds: 300,
  })
  // alice 的简答题作答（v1 不判分：交卷后展示参考答案供自评）
  simulateExam({
    userId: alice.id,
    draft: d3,
    submitTime: daysAgo(3),
    shortAnswers: {
      [q27.id]: '快排用分治，选基准划分后递归。最坏 O(n²)，发生在划分极不平衡时。',
      [q28.id]: '用快慢指针，快指针走两步慢指针走一步，相遇即有环，时间 O(n) 空间 O(1)。',
      [q29.id]: '1NF 字段原子；2NF 消除部分依赖；3NF 消除传递依赖。读多写少可反范式。',
      [q30.id]: '穿透是查不存在的数据；击穿是热点 key 失效；雪崩是大量 key 同时失效。',
      [q31.id]: 'CAP 是一致性、可用性、分区容错性，P 必须保留，所以在 C 和 A 之间取舍。',
    },
    usedSeconds: 1200,
  })
  // alice 未交卷的答题记录（用于演示"退出后继续作答"）
  simulateExam({
    userId: alice.id,
    draft: d1,
    submitTime: minutesAgo(30),
    wrongQuestionIds: [],
    partial: {
      [q1.id]: q1.answer,
      [q2.id]: wrongAnswerOf(q2),
      [q4.id]: q4.answer,
    },
    usedSeconds: 180,
  })
  // bob（隐私主页）的作答记录
  simulateExam({
    userId: bob.id,
    draft: d1,
    submitTime: daysAgo(7),
    wrongQuestionIds: [q2, q5, q9].map((q) => q.id),
    usedSeconds: 800,
  })
  // carol（已注销用户）的历史记录：注销不改变历史数据的可见性
  simulateExam({
    userId: carol.id,
    draft: d1,
    submitTime: daysAgo(60),
    wrongQuestionIds: [q1, q6].map((q) => q.id),
    usedSeconds: 660,
  })

  /* ================================================================== */
  /* v1-plus 模块1：知识点知识库种子（14 号 §4）                          */
  /* ================================================================== */
  /*
   * 说明：知识点可与「考点标签」「题目」双向关联，这里刻意覆盖几种情况：
   *   - 公开 / 私有各有样本（用于验证广场只展示公开、私有仅作者可见）
   *   - 绑定 0 个标签的知识点（15 号 KG-03：广场仍展示，但按标签筛选命中不到）
   *   - 绑定多个标签、跨分类的知识点（用于验证分类筛选与标签流）
   *   - 关联题目含「已存在于多份试卷」的题目（用于验证跳转试卷预览页的择优逻辑）
   */
  const seedUser = (name: string): SysUser => users.find((u) => u.username === name)!
  const knowledge: Knowledge[] = []
  const knowledgeTagRels: KnowledgeTagRel[] = []
  const knowledgeQuestionRels: KnowledgeQuestionRel[] = []
  const knowledgeAnnotations: KnowledgeAnnotation[] = []

  const addKnowledge = (
    username: string,
    title: string,
    summary: string,
    content: string,
    visibility: Visibility,
    tagNames: string[],
    questionIds: number[],
    createdDaysAgo: number,
  ): Knowledge => {
    const article: Knowledge = {
      ...base('knowledge'),
      createTime: daysAgo(createdDaysAgo),
      updateTime: daysAgo(Math.max(0, createdDaysAgo - 3)),
      userId: seedUser(username).id,
      title,
      summary,
      content,
      visibility,
    }
    knowledge.push(article)
    tagNames.forEach((n) => {
      knowledgeTagRels.push({ ...base('knowledgeTagRels'), knowledgeId: article.id, tagId: tagId(n) })
    })
    questionIds.forEach((qid) => {
      knowledgeQuestionRels.push({
        ...base('knowledgeQuestionRels'),
        knowledgeId: article.id,
        questionId: qid,
      })
    })
    return article
  }

  // 取几道真实存在的题目做关联，保证「知识点 → 题目 → 试卷预览」链路可演示
  const q = (index: number): number => questions[index % questions.length].id

  addKnowledge(
    'admin',
    '子网划分与 CIDR 速查',
    '把「借位—掩码—可用主机数」三步固定下来，考场上不用现推。',
    [
      '## 一句话结论',
      '',
      '划分子网就是**从主机位借位**：借 n 位 → 子网数 2^n，每个子网可用主机数 2^(剩余主机位) − 2。',
      '',
      '### 三步走',
      '',
      '1. 看掩码前缀（如 `/26`），算出主机位数 `32 − 26 = 6`',
      '2. 可用主机数 = `2^6 − 2 = 62`（减掉网络号与广播地址）',
      '3. 子网块大小 = `256 − 掩码第四段值`，用它切分网段',
      '',
      '| 前缀 | 掩码 | 块大小 | 可用主机 |',
      '| --- | --- | --- | --- |',
      '| /24 | 255.255.255.0 | 256 | 254 |',
      '| /25 | 255.255.255.128 | 128 | 126 |',
      '| /26 | 255.255.255.192 | 64 | 62 |',
      '| /27 | 255.255.255.224 | 32 | 30 |',
      '',
      '> 易错点：题目问「可用主机数」时一定要减 2；问「子网数」时不要再减。',
      '',
      '```text',
      '192.168.1.0/26',
      '  → 网络号   192.168.1.0',
      '  → 第一个可用 192.168.1.1',
      '  → 最后一个可用 192.168.1.62',
      '  → 广播     192.168.1.63',
      '```',
      '',
      '### 反向验证',
      '',
      '给一个 IP 判断属于哪个子网：把 IP 与掩码**按位与**，结果就是网络号。这一步不要靠心算，写下来最快。',
    ].join('\n'),
    Visibility.PUBLIC,
    ['计算机网络', '计算机基础'],
    [q(0), q(1)],
    21,
  )

  addKnowledge(
    'admin',
    '进程与线程：面试答题框架',
    '别背定义，按「资源分配 / 调度单位 / 切换代价 / 通信方式」四句话答完。',
    [
      '## 四句话框架',
      '',
      '1. **资源分配**：进程是资源分配的基本单位，线程是调度的基本单位',
      '2. **地址空间**：同进程内线程共享地址空间，进程之间相互隔离',
      '3. **切换代价**：线程切换不换页表，比进程切换便宜',
      '4. **通信方式**：进程间要走 IPC（管道 / 共享内存 / 消息队列 / 信号），线程直接读写共享变量但要加锁',
      '',
      '### 追问：什么时候用多进程？',
      '',
      '- 需要**隔离性**（一个挂了不影响另一个）',
      '- 要绕过 GIL / 单线程瓶颈，且进程间数据交换不频繁',
      '- 需要 CPU 密集型并行且语言运行时对多线程不友好',
      '',
      '### 追问：线程数开多少合适？',
      '',
      'CPU 密集型约等于核数；IO 密集型可以更大，但要考虑内存与上下文切换成本。**别背固定数字，讲清楚依据**。',
    ].join('\n'),
    Visibility.PUBLIC,
    ['操作系统', 'Java基础'],
    [q(2)],
    14,
  )

  addKnowledge(
    'alice',
    '数据库范式与反范式：什么时候该拆表',
    '三范式不是教条，回答「为什么冗余」比背定义更加分。',
    [
      '## 三范式速记',
      '',
      '- **1NF**：字段不可再分',
      '- **2NF**：非主键字段完全依赖主键（消掉部分依赖）',
      '- **3NF**：非主键字段不传递依赖主键',
      '',
      '## 反范式不是错',
      '',
      '读多写少、联表代价高的场景，**适度冗余**反而更好：',
      '',
      '| 场景 | 做法 |',
      '| --- | --- |',
      '| 订单列表要显示用户名 | 订单表冗余 `user_name` |',
      '| 统计报表要聚合 | 单独建汇总表，定时刷新 |',
      '',
      '> 关键是把「一致性由谁保证」讲清楚：靠事务、靠定时对账，还是接受最终一致。',
    ].join('\n'),
    Visibility.PUBLIC,
    ['数据库设计', 'MySQL索引'],
    [q(3)],
    9,
  )

  addKnowledge(
    'bob',
    'HTTP 与 HTTPS 握手流程笔记',
    'TLS 握手记「四次往返」比记步骤名更稳。',
    [
      '## HTTP 请求到响应的完整链路',
      '',
      '1. DNS 解析（浏览器缓存 → 系统缓存 → 递归查询）',
      '2. TCP 三次握手',
      '3. **TLS 握手**（HTTPS 独有）',
      '4. 发请求、等响应、四次挥手',
      '',
      '## TLS 握手在做什么',
      '',
      '- 协商算法套件',
      '- 服务器出示证书，客户端校验（CA 链 + 域名 + 有效期）',
      '- 交换密钥材料，派生对称密钥',
      '- 之后所有数据用**对称加密**传输（非对称只用来协商）',
      '',
      '> 为什么不全用非对称？慢。非对称只解决「安全地交换对称密钥」这一件事。',
    ].join('\n'),
    Visibility.PUBLIC,
    // 刻意不绑标签：用于验证 15 号 KG-03（无标签的公开知识点仍应展示，但按标签筛选命中不到）
    [],
    [q(4)],
    5,
  )

  const privateArticle = addKnowledge(
    'alice',
    '我的错题本：位运算易错点',
    '私有笔记，只有我能看到。',
    [
      '## 我总错的三个点',
      '',
      '1. 负数右移：`>>` 是算术右移（补符号位），`>>>` 才是逻辑右移',
      '2. 左移溢出：`1 << 32` 在 Java 里等于 `1 << 0`（移位量对 32 取模）',
      '3. 异或交换两个数时，**不能对自己异或**（会清零）',
      '',
      '> 这条是私有的：广场上不该出现，别人直接访问也应该被拦。',
    ].join('\n'),
    Visibility.PRIVATE,
    ['Java基础', '进制转换'],
    [q(5)],
    3,
  )

  addKnowledge(
    'bob',
    '待补充：UML 用例图',
    '草稿，还没写完。',
    '## 待办\n\n- 补参与者与用例的关系\n- 补 include / extend 区别\n',
    Visibility.PRIVATE,
    ['系统设计'],
    [],
    1,
  )

  // 批注：仅本人可见（15 号 KD-06 用它对拍）
  knowledgeAnnotations.push({
    ...base('knowledgeAnnotations'),
    knowledgeId: privateArticle.id,
    userId: seedUser('alice').id,
    content: '复习提醒：位运算那题我错在第 2 点，考试前再看一遍移位取模的规则。',
  })

  /* ================================================================== */
  /* v1-plus 模块2：题目私有笔记种子（14 号 模块2）                        */
  /* ================================================================== */
  /*
   * 刻意造两种情况，供 15 号 NT-01 ~ NT-06 对拍：
   *   - 一道「有笔记」的题（alice，含 Markdown）
   *   - 其余题无笔记 → 面板打开应为空并提示「暂无个人笔记」
   */
  const questionNotes: QuestionNote[] = []
  const aliceWrongQuestion = records.find((r) => r.userId === seedUser('alice').id)?.questionId
  if (aliceWrongQuestion) {
    questionNotes.push({
      ...base('questionNotes'),
      userId: seedUser('alice').id,
      questionId: aliceWrongQuestion,
      content: [
        '第三遍终于做对了，记一下当时的坑：',
        '',
        '1. 先把选项里的「**一定**」「**必须**」圈出来，这种词往往就是错项的信号',
        '2. 算完顺手用反向代入验一遍，比重新推一遍快',
        '',
        '> 这条笔记只有我自己看得到，别人翻我的错题记录也看不到。',
      ].join('\n'),
    })
  }

  /* ================================================================== */
  /* v1-plus 模块3：多态收藏种子（14 号 模块3）                            */
  /* ================================================================== */
  /*
   * 刻意覆盖四种情况，供 15 号 FA-01 ~ FA-07 对拍：
   *   1) 可访问的公开试卷
   *   2) 可访问的题目
   *   3) 可访问的公开知识点
   *   4) **不可访问**的试卷：指向 bob 的私有底稿 —— 模拟「原本公开、后来转为私有」，
   *      用于验证「收藏记录不删除、条目置灰、仍可取消收藏」
   */
  const favorites: Favorite[] = []
  const seedAliceId = seedUser('alice').id
  const seedAdminId = seedUser('admin').id
  const seedBobId = seedUser('bob').id

  const publicDraftOfAdmin = drafts.find(
    (d) => d.userId === seedAdminId && d.visibility === Visibility.PUBLIC && d.deleted === 0,
  )
  if (publicDraftOfAdmin) {
    favorites.push({
      ...base('favorites'),
      userId: seedAliceId,
      targetType: FavoriteTargetType.DRAFT,
      targetId: publicDraftOfAdmin.id,
    })
    // 该试卷里的第一道题也收藏一下
    const rel = draftQuestionRels.find(
      (r) => r.draftId === publicDraftOfAdmin.id && r.deleted === 0,
    )
    if (rel) {
      favorites.push({
        ...base('favorites'),
        userId: seedAliceId,
        targetType: FavoriteTargetType.QUESTION,
        targetId: rel.questionId,
      })
    }
  }
  // 收藏一篇公开知识点（seed 里的第一篇公开知识点）
  const publicArticle = knowledge.find((k) => k.visibility === Visibility.PUBLIC)
  if (publicArticle) {
    favorites.push({
      ...base('favorites'),
      userId: seedAliceId,
      targetType: FavoriteTargetType.KNOWLEDGE,
      targetId: publicArticle.id,
    })
  }
  // 不可访问样本：bob 的私有底稿
  const bobPrivateDraft = drafts.find(
    (d) => d.userId === seedBobId && d.visibility === Visibility.PRIVATE && d.deleted === 0,
  )
  if (bobPrivateDraft) {
    favorites.push({
      ...base('favorites'),
      userId: seedAliceId,
      targetType: FavoriteTargetType.DRAFT,
      targetId: bobPrivateDraft.id,
    })
  }

  /* ================================================================== */
  /* v1-plus 模块4：反馈工单种子（14 号 模块4）                            */
  /* ================================================================== */
  /*
   * 覆盖三种状态 + 一种异常：
   *   1) 待处理（题目仍在）→ 管理员可处理
   *   2) 已处理（带管理员备注）→ 验证状态与备注展示
   *   3) **题目已被删除**的工单 → 验证 FB-02「工单保留 + 预览处标注题目已删除」
   */
  const feedbackTickets: FeedbackTicket[] = []
  const aliceId = seedUser('alice').id
  const bobId = seedUser('bob').id
  const adminId = seedUser('admin').id

  const someQuestion = questions[0]
  if (someQuestion) {
    feedbackTickets.push({
      ...base('feedbackTickets'),
      createTime: daysAgo(3),
      updateTime: daysAgo(3),
      userId: aliceId,
      questionId: someQuestion.id,
      description: '这道题的解析里把「按位与」写成了「按位或」，结果没错但推导过程对不上，麻烦核对一下。',
      status: FeedbackStatus.PENDING,
    })
  }

  const anotherQuestion = questions[1]
  if (anotherQuestion) {
    feedbackTickets.push({
      ...base('feedbackTickets'),
      createTime: daysAgo(9),
      updateTime: daysAgo(7),
      userId: bobId,
      questionId: anotherQuestion.id,
      description: '选项 C 和 D 的表述几乎一样，看不出区别，怀疑有笔误。',
      status: FeedbackStatus.HANDLED,
      adminRemark: '已确认题干笔误，按「复制为新题」流程修正，原题保留不动。',
      handledBy: adminId,
      handledTime: daysAgo(7),
    })
  }

  // 题目已被删除的工单：questionId 指向一个不存在的题目
  feedbackTickets.push({
    ...base('feedbackTickets'),
    createTime: daysAgo(1),
    updateTime: daysAgo(1),
    userId: aliceId,
    questionId: 999999,
    description: '（这条反馈对应的题目后来被删掉了，用于验证工单本身不跟着删）',
    status: FeedbackStatus.PENDING,
  })

  return {
    users,
    categories,
    categoryTagRels,
    categoryWeights,
    tags,
    drafts,
    draftQuestionRels,
    questions,
    questionTagRels,
    exams,
    examQuestions,
    records,
    wrongDetails,
    knowledge,
    knowledgeTagRels,
    knowledgeQuestionRels,
    knowledgeAnnotations,
    questionNotes,
    favorites,
    feedbackTickets,
    seq,
  }
}
