// 用一个全局变量存储被注册的副作用函数
let activeEffect;
// 存储副作用函数的捅
const bucket = new WeakMap();

// 原始数据
const data = { text: 'hello world' }

// 用于注册副作用函数
function effect (fn) {
	activeEffect = fn
	fn()
}

// 代理原始数据
const obj = new Proxy(data, {
	get (target, key) {
		debugger
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
		return target[key]
	},
	set (target, key, newValue) {
		debugger
		target[key] = newValue
		// 根据target从桶中获取depsMap
		const depsMap = bucket.get(target);
		if (!depsMap) return
		// 根据key值从depsMap中获取副作用函数集合effects 
		const effects = depsMap.get(key);
		// 执行所有相关联的副作用函数
		effects && effects.forEach(fn => fn())
		return true
	}
})

// 执行副作用函数，触发读取
effect(() => {
	document.body.innerText = obj.text
})

// 1秒后修改响应式数据
setTimeout(() => {
	obj.text = 'hello vue3'
}, 1000)

