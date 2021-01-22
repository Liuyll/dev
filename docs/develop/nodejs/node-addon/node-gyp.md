# node-gyp

`node-gyp`实际上是一个编译源码的跨平台工具，`node native`的库并没有进行二进制分发，而是通过源码分发后，调用各平台的编译软件进行动态编译生成代码的。（在`osx`上用`xcode`，`win`上`vs`，linux上使用`g++`等）



## binding.gyp的配置

实际上，我们要先学习一下关于`binding.gyp`的配置，才能更好的使用`node-gyp`

一个最简单的配置如下：

```
{   
    "include_dirs": ["<!(node -p \"require('node-addon-api').include_dir\")"],
    "targets": [
        {
            "target_name": "skiplist",
            "sources": ["src/index.cc"],
        }
    ]
}
```

它包含了需要查找的`node-api`库地址，否则无法编译`node-addon`，同时指定了要编译的源码。



### 编译选项

很显然，这还不够，我们需要更多的配置选项来控制编译。

```
{
  'targets': [
    {
      'target_name': 'hsfProtocol',
      'sources': ['hsf_protocol.cc'],
      'cflags': ['-fexceptions', '-Wall', '-D_FILE_OFFSET_BITS=64','-D_LARGEFILE_SOURCE', '-O2'],    //编译选项
      'cflags_cc': ['-fexceptions', '-Wall', '-D_FILE_OFFSET_BITS=64','-D_LARGEFILE_SOURCE', '-O2'], // c++ 编译选项
      'cflags!': ['-fno-exceptions'],    //关闭的编译选项
      'cflags!_cc': ['-fno-exceptions'],
      'conditions': [
        ['OS=="mac"', {    //满足此条件后开启
          'xcode_settings': {
            'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
          }
        }]
        ],
    }
  ]
}
```







# 附录：gcc/g++ 编译命令

+ `-Wall`：暴露所有警告信息
+ `-S`：只输出汇编代码
+ `-C`：只输出目标文件，但不进行链接
+ `-lxxx`：链接某个库
+ `gcc xxx -o xxx abc def`：指定`abc,def`库参加编译
+ `-O(0-3)`：指定优化级别，由低到高
+ exception:
  + `-fexceptions`：默认情况，支持`try,catch,exception`等异常处理
  + `-fno-exceptions`：关闭异常处理



## 附录

[compiler reference guide](https://www.keil.com/support/man/docs/armclang_ref/armclang_ref_chr1418137380191.htm)