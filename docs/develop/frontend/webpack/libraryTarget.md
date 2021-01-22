## 打包成了什么

首先要明白，`webpack`把一个`entry`文件打包成了一个自执行函数



## 配置

+ `commonjs`

  设置为`commonjs`后，`webpack`会把该执行函数导出为`library`配置的名字

  ```
  {
  	library: 'lodash',
  	libraryTarget: 'commonjs'
  }
  ... 引入
  const { lodash } = require('xxx')
  ```

  此时自执行函数的返回值被赋值在`library`的值变量上面

  需要在引入`bundle`的包上面在进行一次`.library`的`getter`才能获得到自执行函数的值

+ `commonjs2`

  commonjs2不需要library配置，因为它直接打包在`module.exports`上面

  也就是说，引入对应的`bundle`包时，直接就是该自执行函数执行后的结果了

+ `var`

  var选项代表着用一个全局变量来储存返回值

+ 