## dev-server

注意一点，使用`dev-server`后，webpack把所有bundle打包在内存的`\`路径中，此时output无效。

### contentPath

它其实等同于使用`koa-static`:

```
app.use(new Static('staticPath'))
```

使用的，所有的静态资源都会以它为根路径来寻找。

```
const Home = () => {
    useEffect(() => {
        console.log(123)
    }, [])
    return (
        <div className="wrap">
            Welcome to Easy-React
            <div className="content">
                <img src='./test.jpg' />
            </div>
        </div>
    )
}
```

此时，`img`里的`src`的图片实际上存储于`/public/test.jpg`里

#### 注意1

`contentPath`下的`index.html`优先级小于`publicPath`下`index.html`的优先级



### publicPath

这里的`publicPath`跟`output`的`publicPath`实际上作用不同

`webpack-dev-server`的`publicPath`实际确定的是访问的前缀：

比如设置:

```
publicPath: '/dist'
```

那么此时必须使用`localhost:9000/dist`才能访问到提供bundle的路径

+ 注意1

  此时output里的`publicPath`也必须设置为相同的路径，否则对应的bundle无法找到

  ##### eg:

  如果output的`publicPath`此时设置为:`/`

  则注入`webpackHtmlPlugin`的bundle前缀全为`/`，很明显，我们的`bundle`只能在`/dist`下才能被访问到，所以全部无法访问，导致页面崩溃

+ 注意2

  即使配置了相同的`publicPath`，如果页面使用了history路由，也会导致页面路由失效，但可以配置路由根路径为`/dist`来解决

