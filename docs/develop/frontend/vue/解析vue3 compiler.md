## 前言

`template`不可谓不是`vue`的`super star`，`template`为`vue`带来了非常大深度的性能优化空间。这次将逐步通过一些场景来看下`vue3`的模板编译及优化措施。



## block node

我更喜欢把`block node`叫做`stable node`，一个`block node`标示着一个`stable fragment`的开始。

`stable`是指稳定的节点，也就是说不参加更新的节点，一个完全静态的节点无论如何也不会被`diff`打上任何的`commit flag`。

然而实际上，大多数节点虽然位于`v-for`或`v-if`两个指令内，但是它们依然是静态节点（作为动态节点的子节点或同级节点）。



一个`block node`有一个`dynamicChildren`属性，在diff时只对比这个数组内的元素。

## fragement

我习惯把一个有隐式`block node`作为父节点的树叫做`fragment`

> 什么叫隐式`block node`

考虑这样一段代码：

```
<div class="wrap">
	<p v-for=(data, index) in datas>{{data}}</p>
	<p class="inner"></p>
	<div class="innet"></p> 
</div>
```

很显然，`p`节点的循环是作用于自身的。而`wrap div`的内部还有一个`inner p`和一个`inner div`。

假设不做任何处理(比如我们使用了`jsx`)，那么最终得到的`wrap div`的`children`就会是一堆无法区分的`p`节点和一个`div`。实际上，一个循环生成的内部节点绝不可能跟循环外部的同级节点做`update patch`。这也就是说，我们的`diff`发生了层级的错乱（正确的层级是循环和循环diff，外部同级节点和外部同级节点diff）。

为了解决这个问题，我们为循环引入了一个隐式的`block node`，把这个叫做`fragment`。

> 是的，跟react的`<>`是一样的



如果一个`fragment`可能因为条件判断，`for`循环等`js`行为导致不会渲染，那它就不是稳定的，反正及稳定。当然，我们在考虑单个节点是不是稳定的时候，不应该考虑父节点是否稳定。



> 一个example

+ `unstable`: 

  ```
  <p v-for=(data, index) in datas>{{data}}</p>
  ```

  这是一个`unstable`的fragment，因为渲染的节点数量取决于`datas`这个变量

+ `stable`

  ```
  <p v-for=(data, index) in 10>{{data}}</p>
  ```

  这个就是标准的`stable fragment`，因为一个常数无论如何不会发生变化

