// 用一个全局变量存储被注册的副作用函数
let activeEffect;
// 存储副作用函数的捅
const bucket = new WeakMap();

const effectStack = []

// 原始数据
const data = { foo: 1, bar: 2 }

/**
 * 用于注册副作用函数
 * @param {*} fn 要执行的函数
 * @param {*} options 选项配置
 */
function effect (fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn)

    // 当effectFn执行时，将其设置为当前激活的副作用函数
    activeEffect = effectFn
    // 在调用副作用函数之前将当前副作用函数压入栈中
    effectStack.push(effectFn)
    const res = fn()

    // 在副作用和函数执行完后，将当前副作用函数弹出，并把 activeEffect 还原为之前的值
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]

    return res
  }
  // 将选项配置挂载到effectFn上
  effectFn.options = options
  // 用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = []
  // 非lazy的时候，执行副作用函数
  if (!options.lazy) {
    effectFn()
  }
  // lazy为true的时候，将副作用函数返回，不立即执行
  return effectFn
}

function cleanup(effectFn) {
  for(let i = 0; i < effectFn.deps.length; i++) {
    // deps是依赖集合
    const deps = effectFn.deps[i];
    // 将effectFn从依赖集合中移除
    deps.delete(effectFn)
  }
  // 清空依赖集合
  effectFn.deps.length = 0
}

// 代理原始数据
const obj = new Proxy(data, {
	get (target, key) {
		track(target, key)
		return target[key]
	},
	set (target, key, newValue) {
		target[key] = newValue
		trigger(target, key)
		return true
	}
})

// 在get拦截函数内调用 track 函数追踪变化
function track (target, key) {
  if (!activeEffect) return;
  // 根据target从bucket中depsMap，它也是一个Map类型： key --> effects
  let depsMap = bucket.get(target)
  // 若不存在，则新建一个Map 并与 target 关联
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }
  // 根据key从depsMap中取得deps，它是一个Set类型
  // 里面存着所有与当前key相关联的副作用函数：effects
  let deps = depsMap.get(key)
  // 若不存在deps，新建一个Set与key关联
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }
  // 最后将当前激活的副作用函数添加到桶里
  deps.add(activeEffect)
  // deps就是一个与当前副作用函数存在联系的依赖集合
  // 将其添加到 activeEffect.deps 数组中
  activeEffect.deps.push(deps)
}

// 在set拦截函数内调用 trigger 函数触发变化
function trigger (target, key) {
  // 根据target从桶中获取depsMap
  const depsMap = bucket.get(target);
  if (!depsMap) return
  // 根据key值从depsMap中获取副作用函数集合effects 
  const effects = depsMap.get(key);

  // 基于原Set构造另外一个Set集合遍历，避免死循环
  const effectsToRun = new Set()
  effects && effects.forEach(effectFn => {
    // 如果trigger触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行，避免无限递归调用
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn)
    }
  })
  // 执行所有相关联的副作用函数
  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
  // effects && effects.forEach(fn => fn())
}

/**
 * 实现computed方法
 * @param {*} getter 传入一个方法
 * @returns 返回一个对象obj，obj.value是副作用函数的结果
 */
function computed (getter) {

  // 缓存结果
  let value;
  // dirty标志，用来判断是否需要重新计算值，为 true ，则意味着 脏 ，需要计算
  let dirty;
  // 把getter作为副作用函数，创建一个lazy的effect
  const effectFn = effect(getter, {
    lazy: true,
    // 添加调度器，在调度器中将dirty设为true，
    // 因为调度器只有在设置属性值的时候才会调用，当属性值变化了，则需要重新执行副作用函数
    scheduler() {
      dirty = true
      // 当计算属性依赖的响应式数据变化，手动调用trigger函数 触发响应
      // 为了解决在另一个副作用函数（effect）中读取一个computed值时，computed依赖的响应式数据变化，effect不会重新计算的问题
      trigger(obj, 'value')
    }
  })

  const obj = {
    // 读取value时，才执行effectFn
    get value() {
      // 脏 时，需要计算值，并将计算得到的值缓存起来
      if (dirty) {
        value = effectFn()
        // 计算结束后，将dirty设为flase，下次访问直接使用缓存的value值
        dirty = false
      }
      // 读取value时，手动调用track函数 进行跟踪
      track(obj, 'value')
      return effectFn()
    }
  }

  return obj
}

const sumRes = computed(() => obj.foo+obj.bar)
effect(() => {
  // 副作用函数中访问计算属性值
  console.log(sumRes.value)
})

// 修改计算属性依赖的响应式数据
obj.foo++

console.log('end')

// 依次打印出 3   4    end

