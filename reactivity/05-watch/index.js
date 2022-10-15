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
    effectStack.push(activeEffect)
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

function watch (source, cb, options = {}) {
  let getter;

  // 如果用户传的是一个函数，把source赋值给getter
  if (typeof source === 'function') {
    getter = source
  } else {
    // 否则就按照原来的实现调用traverse递归的读取
    getter = () => traverse(source)
  }

  let oldValue, newValue;

  // scheduler为一个独立的job函数
  const job = () => {
    // 重新执行副作用函数，得到的是新值
    newValue = effectFn()
    // 将新旧值作为回调函数的参数，传给用户侧
    cb(newValue, oldValue)
    // 将当前的新值赋给oldValue，作为下一次的旧值
    oldValue = newValue
  }


  const effectFn = effect(
    () => getter(),
    {
      lazy: true,
      scheduler: () => {
        // flush为post时，说明job需要后置执行，利用微任务原理去后置执行
        if (options.flush === 'post') {
          Promise.resolve().then(job)
        } else {
          // 这里相当于同步执行（flush=sync）
          job()
        }
      }
    }
  )

  if (options.immediate) {
    // immediate为true时，立即执行job，触发回调
    job()
  } else {
    // 手动调用副作用函数，拿到的就是旧值，但不执行cb，因为cb是在数据更新时通过scheduler进行调用的
    oldValue = effectFn()
  }
}

function traverse(value, seen = new Set()) {
  if (value == null || typeof value !== 'object' || seen.has(value)) {
    return;
  }
  // 将数据添加到seen中，代表遍历过了，避免循环引用引起死循环
  seen.add(value)

  // 假设value就是一个对象
  for (const k in value) {
    traverse(value[k], seen)
  }

  return value
}

watch(() => obj.foo, (newVal, oldVal) => {
  console.log('newVal:', newVal, 'oldVal', oldVal)
})

// 修改计算属性依赖的响应式数据
obj.foo++


// 依次打印出 2  1 

/**
 * 此处watch实现有问题，当source为响应式数据传入，输出结果有错误
 * 待作者更新仓库代码，关联issue为：https://github.com/Esdiarap/vuejs3Code--HcySunYang-Ver./issues/9
 */

