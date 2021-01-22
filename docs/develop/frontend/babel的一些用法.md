## preset

### preset-env

#### 全量polyfill

我们主要将一下`useBuiltIns`这个配置

实际上，`babel`转换的是语法和函数两个方面，`env`支持了语法，但是函数还是需要垫片，也就是`polyfill`来转换。

正常情况下，我们直接在文件里引入全局的`@babel/polyfill`即可做全局垫片，但是这个包太大，全部引入不太划算。

如果全量引入，指定`useBuiltIns`为`entry`或者不指定即可。



#### 按需引入

我们可以配置`useBuiltIns`，然后让`corejs`去在需要的地方在实时的添加垫片

```
 "presets": [
        [
            "@babel/preset-env",
            {
                "useBuiltIns": "usage",
                "corejs": {
                    "version": 3, // 使用core-js@3
                    "proposals": true // 支持还在提案中的api
                }
            }
        ],
        "@babel/preset-react",
        "@babel/preset-typescript"
]
```

> 这里需要注意的是，`corejs`默认使用2，如果使用3，需要指定版本



#### transform-runtime

刚才提到了按需引入，但引入的方法是在需要的地方添加对应的`polyfill`函数，如果有多个需要引入相同`polyfill`的地方，那这个垫片也会被写入多次。

此时引入`transform-runtime-plugin`即可，它提供了一个库，让所有的`polyfill`直接从里面引入，又不污染全局变量。

```
{
    "plugins": [
        "@babel/plugin-transform-runtime",
    ],
    "presets": [
        [
            "@babel/preset-env",
            {
                "useBuiltIns": "usage",
                "corejs": {
                    "version": 3, // 使用core-js@3
                    "proposals": true
                }
            }
        ]
    ]
}
```

