通过开启`go env -w GO111MODULE=on`后标识开启整个`go-module`环境



## 依赖

### 依赖安装

在`go module`里，可以不用预先`go get`下载依赖，在运行时，`module`会自动寻找依赖并下载。



### 依赖寻找

在`go module`里，不会再从`GOPATH`里寻找依赖，而是从`module`里查找

此时依赖包地址储存在`${GOPATH}/pkg`里

