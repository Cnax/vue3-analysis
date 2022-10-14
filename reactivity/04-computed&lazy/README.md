1. 在包装的副作用函数中，添加options.lazy(延迟执行属性)，options.lazy为true时，将副作用函数作为返回值返回，并且要将用户侧传入的真正副作用函数执行的结果值返回；

2.解决多次使用computed value（计算属性值），effectFn重新执行的问题，在computed函数中定义了一个value变量和一个dirty变量，value用来缓存上一次计算的值，dirty用来判断是否需要重新计算，当读取了obj.value时，也就是执行了 get value函数，在函数内部，判断dirty=true时，将effectFn的计算结果赋值给value，进行一个缓存，并将dirty置为false，以便下次直接访问value；

3.为了解决当响应式数据发生变化时，让计算属性重新计算的问题，需要在设置响应式数据为一个新的值的时候，添加一个调度方法（scheduler
），在调度方法中将dirty置为true，这样就能使响应式数据变化时，计算属性方法（computed），能够重新执行；

4.为了解决在另一个副作用函数（effect）中读取一个computed值时，computed依赖的响应式数据变化，effect不会重新计算的问题，我们在读取计算属性的值时，手动调用track方法，进行跟踪属性，并在调度器（scheduler）中，手动调用trigger触发响应

最后形成一个响应式数据的结构：
computed(obj) => value => effectFn

