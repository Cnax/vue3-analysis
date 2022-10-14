// 用一个全局变量存储被注册的副作用函数
let activeEffect;
// 存储副作用函数的捅
const bucket = new WeakMap();

const effectStack = []

// 原始数据
const data = { foo: 1 }

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
    fn()

    // 在副作用和函数执行完后，将当前副作用函数弹出，并把 activeEffect 还原为之前的值
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
  }
  // 将选项配置挂载到effectFn上
  effectFn.options = options
  // 用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = []
  effectFn()
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

// 执行副作用函数，触发读取
// effect(() => {
// 	console.log(obj.foo)
// })

effect(() => {
  console.log(obj.foo)
}, {
  scheduler(fn) {
    setTimeout(fn, 3000)
  }
})

obj.foo++

console.log('end')

// 依次打印出  1   end     2
