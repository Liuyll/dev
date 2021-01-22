## 从readableStream谈起

#### 先看看实现一个readable

```
function MyReadable(options){
		Readable.call(this,options)
		...doSomething
}
Util.inherits(MyReadable,Readable)

new MyReadable({
		read!:new Function()
})
```

#### read和_read做了什么？

由命名可以看出,_read是底层方法，而read是我们实现的方法。

#### _read

> 当 `readable._read()` 被调用时，如果从资源读取到数据，则需要开始使用 [`this.push(dataChunk)`](http://nodejs.cn/s/8s3paZ) 推送数据到读取队列。 `_read()` 应该持续从资源读取数据并推送数据，直到 `readable.push()` 返回 `false`。 若想再次调用 `_read()` 方法，则需要恢复推送数据到队列。
>
> 一旦 `readable._read()` 方法被调用，将不会再次调用它，直到更多数据通过 [`readable.push()`](http://nodejs.cn/s/8s3paZ) 方法被推送。 空的数据（例如空的 buffer 和字符串）将不会导致 `readable._read()` 被调用。

文档里明确指出，_read调用后将不会再被调用，直至调用push后才会重新被调用。

```javascript
 _read() {
    const data = this.dataSource.makeData();
    setTimeout(() => this.push(data),1000);
 }
// 每隔1s输出一次
```

#### push

话不多说，看下push做了什么

```javascript
Readable.prototype.push = function(chunk, encoding) {
  return readableAddChunk(this, chunk, encoding, false);
};
```

##### readableAddChunk:

```javascript
function readableAddChunk(stream, chunk, encoding, addToFront) {
  debug('readableAddChunk', chunk);
  const state = stream._readableState;

  let skipChunkCheck;

  // ... 省略对是否是对象模式流的一些处理
  skipChunkCheck = true;

  if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else {
    // ... 省略一些处理
    maybeReadMore(stream, state);
  }
```

继续看下`maybeReadMore`

实际上，`maybeReadMore`通过`nextTick`调用了`_maybeReadMore`

```
process.nextTick(maybeReadMore_, stream, state)
```

而`maybeReadMore`的实现更简单，就是判断条件是否允许，如果允许则调用`read(0)`递归的读取。



##### addChunk

`addChunk`将从数据源读取到的`chunk`储存到`ReadStream`的buffer里

```
function addChunk(stream, state, chunk, addToFront) {
  if (state.flowing && state.length === 0 && !state.sync &&
      stream.listenerCount('data') > 0) {
    stream.emit('data', chunk);
  } else {
    // Update the buffer info.
    state.length += state.objectMode ? 1 : chunk.length;
    if (addToFront)
      state.buffer.unshift(chunk);
    else
      state.buffer.push(chunk);

    if (state.needReadable)
      emitReadable(stream);
  }
  maybeReadMore(stream, state);
}

```

`addChunk`有两条出路：

+ 触发readable

+ 触发data

  触发data的条件必须满足以下几点：

  + 监听了`data`事件

  + 必须处于`flowing`状态

  + `state.length === 0`：此时缓冲区无数据

  + `!state.sync`：异步状态

    `push`会在`_read`里由实现者自行调用，很明显如果为异步获取数据的话，那么`push`也会被异步调用

    而在`read`方法里是这样调用`_read`的:

    ```
    state.sync = true;
    this._read(state.highWaterMark);
    state.sync = false;
    ```

    很巧妙的写法是默认将`sync`置为同步，此时`push`同步调用即为`true`，异步调用即为`false`。

    

  考虑一下为什么需要这几个条件来判断是否直接触发`data`事件呢？

  实际上，在异步获取数据(当然也就需要异步`push`)的情况下，我们调用的`read`方法可能无法读取到数据(此时数据还在从底层数据源加载)，那么`read`方法将会返回一个`null`值。后面获取到数据以后，自然需要立即通知`Consumer`进行消费，此时触发`data`事件。

  而在同步获取数据时，则不存在这个问题，`read`方法调用`_read`同步获取数据，此时直接将获取到的`chunk`加入到`ReadStream`的数据仓库里，运行后面的逻辑即可。

#### read

> 按照文档的说明:
>
> readable.read() 应该只对处于暂停模式的可读流调用。 在流动模式中， readable.read() 会自动调用直到内部缓冲的数据完全耗尽。
>
> read只读取暂停模式的流，而流动模式的流由`data`事件来读取

看一个简单例子

```
readable.on('readable', () => {
  let chunk;
  console.log('Stream is readable (new data received in buffer)');
  // Use a loop to make sure we read all currently available data
  while (null !== (chunk = readable.read())) {
    console.log(`读取 ${chunk.length} 字节的数据`);
  }
});
```

此时流处在暂停模式，通过循环`read`读取所有缓冲区的数据。

##### 运作流程

实际上，我们可以把`ReadStream`当做一个标准的生产者消费者模型：

+ 生产者：由底层的数据生产源产生，通过内部的`buffer`将数据通过`push`方法生产到缓冲区
+ 消费者：由上层的使用者调用，通过`read`方法将缓冲区的数据读出



##### 底层逻辑

read的行为应该是实现者(`_read函数`)来定义，比如在fs里，read会触发 `readable`事件

<b>事实上，read是依靠触发底层的_read函数来触发readable事件的</b>

而对`data`事件的监听，则自动会触发read

~~而每次read的size，我们又可以通过设置highWaterMark来指定~~

***注意，上面这句话是有问题的，标准的read实现里，size只应为0来触发底层_read***

### 

### 可控

+ pause
+ resume
+ destory



#### 处理背压问题(backpressure)

对于一个可读流来说，当它被pipe到一个可写流的一端时。`highwatermark`就会类似于滑动窗口一样来控制读写的速度了

一旦可读流的***highwatermark***高于标志位，可写流就无法write了，我们可以通过<b>ok</b>标志位来表示是否背压

```javascript
function write(){
  do {
    ok = writer.write(data)
  } while(ok)
  
  writer.pause()
  writer.once('drain',write)
}
  
write()
```

然而，即使一个可读流的`highwatermark`已经超出，即`write`返回一个`false`时，依然可以继续写入可读流。

此时`nodejs`会把数据缓存到内存，直到内存超出nodejs指定的上限为止。



#### 考虑一下createReadStream(file)是怎么实现的

实际上，可读流我们已经分析清楚了。原理就是通过一个容量为`highwatermark`的`buffer`来进行分批读写。

然而，我么还是没有弄清楚，这个机制如何结合我们的文件系统来进行。

实际上，也是调用`fs.read`来进行读取的，获取句柄后，就可以按照我们上面的逻辑来进行了。

```
 fs.read(
        this.fd,
        this.buffer,
        0,
        howMuchToRead,
        this.pos,
        (err, bytesRead) => {
            // 如果读到内容执行下面代码，读不到则触发 end 事件并关闭文件
            if (bytesRead > 0) {
                // 维护下次读取文件位置
                this.pos += bytesRead;

                // 保留有效的 Buffer
                let realBuf = this.buffer.slice(0, bytesRead);

                // 根据编码处理 data 回调返回的数据
                realBuf = this.encoding
                    ? realBuf.toString(this.encoding)
                    : realBuf;

                // 触发 data 事件并传递数据
                this.emit("data", realBuf);

                // 递归读取
                if (this.flowing) {
                    this.read();
                }
            } else {
                this.isEnd = true;
                this.emit("end"); // 触发 end 事件
                this.detroy(); // 关闭文件
            }
        }

```

当然，我们每次都要更新这个`bytesRead`变量

默认情况下，这个变量等于`HW`。但是如果我们设置了结束位置，或者剩余数据不足`HW`时，就会选择合适的值。

```
let howMuchToRead = this.end
        ? Math.min(this.highWaterMark, this.end - this.pos + 1)
        : this.highWaterMark;
```

这实际上跟我们上面提到的`_read`的逻辑是一致的，也是真正用于读取的部分

当然，我们还需要不断的更新`highwatermark`。



### 实现一个可读流

在上面的分析里，我们知道`ReadStream`暴露`read`来使消费者读取数据，此时我们只需要重写`_read`方法作为业务逻辑实现即可

```
const Readable = require('stream').Readable;

class RandomNumberStream extends Readable {
    constructor(max) {
        super()
    }

    _read() {
        const ctx = this;
        setTimeout(() => {
            const randomNumber = parseInt(Math.random() * 10000);
            ctx.push(`${randomNumber}\n`);
        }, 100);
    }
}
```



## ReadStream

实际上，`ReadStream`就是一个大的状态机，里面储存了各种变化的状态和事件。

#### 变量分析

我们分析几个非常重要的变量

+ `state`：state状态储存了`ReadStream`内部运行的状态

   + `objectMode`: 是否是对象模式，处于对象模式的流`读取/储存/输出`的是队列形式的数据

     ```
     objectReadStream.push('a')
     objectReadStream.push('b')
     objectReadStream.on('data',(d) => d) // a,b
     ```

     

  + `length`: length代表该`ReadStream`缓存中剩余的数量，初始时是0

  + `ended`: 流是否结束

    判断`ended`的条件十分关键，它在`onEofChunk`里被设置为`true`，而在`readableAddChunk`里根据条件判断调用了`onEofChunk`

    ```
    function readableAddChunk(stream, chunk, encoding, addToFront) {
      // ...objectMode 
      
      if (err) {
        // ...
      } else if (chunk === null) {
        state.reading = false;
        onEofChunk(stream, state);
      } // ...
    }
    
    ```

    如果传入给`readableAddChunk`的`chunk`是空的话，那么可以认为已经没有数据能读取了，此时调用`onEofChunk`标识流结束。

    在上面的分析里提到过，在`push`里会调用`readableAddChunk`

    ```
    Readable.prototype.push = function(chunk, encoding) {
      return readableAddChunk(this, chunk, encoding, false);
    };
    ```

    

  + `needReadable`：是否触发`readable`
  
    判断条件是`state.length <= state.highWaterMark`。
  
    `needReadable`标识着如果缓冲区数量大于阈值，则无需从底层数据源读取数据，即无需调用`_read`

### readableBuffer

上面已经分析过，`ReadStream`不一定能`push`成功数据，此时需要一个内部buffer来缓存这些数据，通过`this.readableBuffer`来获取到这个内部buffer。

不一定push成功的原因可能是消费者端阻塞，即无`data`监听也无`read`主动读取

看一个例子

```
const t = Buffer.alloc(11)
this.push(t)
...
rs.read(10)
console.log(rs.readableBuffer)
// BufferList { head: [Object], tail: [Object], length: 1 }
```

可以看到读了10个数据后，内部缓存还有1个数据的缓存。`length`也可以由`readableLength`取得

但这只是不`push`超过`highWaterMark`的情况，实际上内部`buffer`的大小就是`highWaterMark`

### 深入Readable Stream

#### readable的几种模式

+ <b>flow</b>

![Flowing](https://www.barretlee.com/blogimgs/2017/06/06/node-stream-readable-flowing.png)

这就是readable工作的原理，资源相当于一个水垒，不断向缓存池冲水，水平面为highWaterMark

+ 静止模式

该模式的触发除了显示调用pause外，在监听readable后也会触发

```
readable.on('readable',() => {
		while((data = readable.read(size)) != null){
				doSomething
		}
})
```



[参考](https://www.barretlee.com/blog/2017/06/06/dive-to-nodejs-at-stream-module/)



## transform双工流

***这里不提及duplex流，因为duplex与transform的唯一区别就是前者是读写流不相关，而后者读写流相关，只做中间处理***

#### _transform

我们用一个删除第一行的文件转换函数来说明这个方法

```javascript
function removeFirstLine(){
  	transform.call(this)
  	this._removed = false
}
util.inherits(removeFirstLine,transfrom)

removeFirstLine.prototype._transfrom = function(chunk,encoding,done){
  if(this._removed){
    this.push(chunk)
  }
  else {
    let string = chunk.toString()
    string = string.slice(string.indexOf('\n')+2)
    this.push(string)
    this._remove = true
  }
  done()
}

input
.pipe(new removeFirstLine())
.pipe(output)
```

<b>注意这里的done,它是必须被触发的回调函数，第一个参数是error</b>



## pipe

### ReadStream.pipe

实际上，`pipe`的实现主要考虑了几个细节：

+ 可读流消费到缓冲区后，能否直接写入到可写流(可写流拥塞)
+ 可写流拥塞后，如何暂停可读流
+ 如何确保可写流恢复写入能力后，恢复可读流



这是最常见的形式，但是有很多细节依然值得我们关心:

1. option提供了一个`end`参数，它代表着`ReadStream end`后，是否关闭可写流，它默认是`true`，开启它以实现多次pipe同一个`WriteStream`

2. 可读流结束后会触发`end`事件
3. 可读流发生错误后，可写流将不会自动关闭





## read源码分析

在我们上面的分析中，提到了`push`会不断的异步触发`read(0)`从数据源读取。

实际上，`read`传入的值不同，它的行为也不同

+ 不传入参数
+ 传入0
+ 传入具体值



### 不传入参数

如果不传入参数，`read`会把值设为`NaN`

```
if (n === undefined) {
    n = NaN;
}
```

后续会进入一个计算，判断当前能读取多少数据。

计算的逻辑比较复杂：

+ 如果n为`NaN`
  + 如果流处于流动模式，则返回第一个`buffer`
  + 如果处于静止模式，直接读取缓存区全部的数据
+ n不为`NaN`
  + 读取指定的数据或缓冲区全部数据

```
function howMuchToRead(n, state) {
  // 对象模式下的处理
  if (state.objectMode)
    return 1;
  if (NumberIsNaN(n)) {
    // Only flow one buffer at a time.
    if (state.flowing && state.length)
      return state.buffer.first().length;
    return state.length;
  }
  if (n <= state.length)
    return n;
  return state.ended ? state.length : 0;
}
```



## 参考

[node.js stream](https://tech.meituan.com/2016/07/15/stream-internals.html)