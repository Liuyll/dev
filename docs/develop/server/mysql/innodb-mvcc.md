### 当前读与快照读

mysql对读取数据有两种策略

#### 快照读

快照读是读取`undo`及其之前的版本。因为是已经提交过的事务，所以读取不会有任何问题，因为没有可能会在出现数据的变更了。问题是容易读到旧的数据。

#### 当前读

而读当前版本的数据又会导致一些问题，可能会有一个新加入的事务直接修改了这个数据，所以需要加排他锁/共享锁。

实际上，除了最普通的`select xxx`是快照读以外。

+ insert
+ update
+ select for update / lock in share mode
+ delete

全部都是当读前



### MVCC

引入MVCC主要还是为了解决当前读需要加锁的问题，加锁非常耗费性能。是否能有一种办法不用加锁，又能进行当前读(不符合条件的数据当然退回到快照读)呢。

### undo

innodb对每个事务都启用了`undo`日志，用于在`rollback`的时候恢复数据。

`undo`实际上是对`redo`的逆向操作，以一个新的提交恢复到之前的数据。



#### wal

后面会提到，`undo log`和`redo log`都是mysql对`WAL`的实现。`undo log`保证的是一致性，`redo log`保证的是持久性。

那么`redo log`为了保证最终可以写入到磁盘，对每一次操作都会有记录。而`undo log`只需要记录事务开始前和事务结束后即可，因为回滚是以一个事务为单位的。（实际上，如果事务中断，那`redo log`是不会被写入到磁盘的）



#### undo的提交流程

上面简单提到过，`undo log`为了保障事务的一致性，也就是说事务失败的时候(硬件导致)，需要`undo log`重写事务。那么我们需要考虑到在事务刷盘的过程中，硬件出现的故障。此时事务还未完全写入到磁盘，重启后需要通过`undo log`恢复。

很显然，`undo log`的写入应该先于事务刷盘。

简单的流程如下：

1. 事务开始
2. 记录快照到`undo log`
3. 更新数据(`redo log`)
4. 写入`undo log`到磁盘
5. 数据刷盘
6. 提交事务

> 后面会提到为什么需要第2步记录快照

### 事务开启提交

`innodb`引擎为每一行都加上了`DB_TRX_ID`和`DB_ROLL_PTR`来表示使用当前列的事务编号和对应的`undo log`指针。

在`transaction`开启后，innodb会自动的为当前的事务号+1

| id   | name | DB_TRX_ID | DB_ROLL_PTR         |
| ---- | ---- | --------- | ------------------- |
| 1    | xxx  | 103       | xxxxx(对应undo指针) |

类似于上述表格，我们每个事务都有一个`DB_TRX_ID`的编号，也有一个指针指向对应`undo log`

此时我们开启一个事务会对使用到的行进行如下操作：

1. 递增事务指针
2. 复制原始数据到`undo log`
3. 修改数据
4. 修改`DB_ROLL_PTR`指针到`undo log`指针，并修改该行对应的事务id



### ReadView

只有当前的事务编号id还不行，我们必须要利用它来进行几个隔离级别的实现。

我们在开启每个事务的时候，创建一个叫做`ReadView`的表，包含以下几个变量:

+ trx_ids: `ReadView`创建时活跃事务(未提交事务)id集合。

+ low_limit_id: 表示着最大事务版本号 + 1
+ up_limit_id: 活跃事务的最小版本号
+ creator_trx_id: 创建该readview的事务版本号

> 多事务并发会出现很多问题，上述变量随readview创建，并不随其他并发事务的更新而更新。

考虑为什么需要这几个变量:

#### trx_ids

注意`trx_ids`代表`ReadView`创建时的活跃事务集合，这意味着即使并发事务提交了这些活跃事务，对该事务也是不可见的(`trx_ids`不可变)

在sql语句里，查询到任意一列时，都可以查询到其对应的事务编号：

#### up_limit_id

它代表着活跃事务的最小id，因为事务id是递增的。所以小于`up_limit_id`的事务一定是在`ReadView`创建前就已经提交过的，这应该满足任意的隔离性要求。

#### low_limit_id

它代表着最大事务的版本号(不管是活跃还是已提交事务)，也就是说：超过该值的事务一定是`ReadView`后创建的，除了脏读，任何时候都不应该显示它的数据。

#### low - up之间

在`low_limit_id`与`up_limit_id`之间的编号，意味着在`ReadView`创建时，该数据可能正在被某活跃事务所操作。这时候需要查询活跃事务编号表`trx_ids`：

+ 若不存在：则表示该事务已经提交，这时候跟小于`up_limit_id`是完全一致的。
+ 若存在，则对比其和`creator_trx_id`来查看其是否是自身创建，若非自身创建，则根据隔离级别判断是否可显示。



根据隔离级别不同，我们可以显示不同版本的数据。

如果不支持显示，我们从`undo`里取数据显示。如果`undo ptr`指向的数据依然不满足要求，我们可以根据链式结构一直找到一个符合要求的版本的数据来使用。

如果支持，我们返回该版本的数据即可。

### 隔离性

上面一直提到了隔离性的问题，实际上隔离性是`ReadView`处理的关键判断因素

#### RU(Read Uncommit)

典型的脏读，一般不使用这种隔离性。这种隔离性会导致任意的事务id都能被显示。

#### RC(read commit)

RC会在每次查询的实现重新更新`ReadView`。这导致在事务开始时候处于活跃状态的事务可能会在事务进行过程中被提交，导致被提交的事务可以被再次读到。

RC不能解决不可重复读的问题，也就是说会可能会出现同一个查询，不同的数据(一次读undo，一次读当前版本)。

#### RR(Repeat Read) 

> 这是mysql的默认隔离级别。

可重复读，可以读取已提交的事务数据。实际上，它只在事务创建的时候创建一个`ReadView`，后续不进行任何更新。所以获取的数据一定相同(要么都从当前版本读，要么都从undo读)。

这里我们可以看出`undo log`在mvcc上的作用了，它实际上作为一个不变的快照来储存数据。

#### SERIALIZABLE

最高级别的隔离，可以解决幻读。

+ 幻读：

  需要讲一下幻读，



### 锁

实际上mvcc是为了解决用锁太低效的问题，所以mvcc本身是不涉及锁的。

注意在使用mvcc时，也可以添加锁来增强并发功能

+ `share in lock mode` 共享锁
+ `for update` 排它锁



#### 隐式的锁

其实除了主动加锁，mysql还对一些情况自动的加锁

比如在精确查询拥有`unique index`的行情况下，会加行锁。

### 2pc

参考上面的`ReadView`，我们也能在业务代码层面实现自己的`mvcc`。

假设在`mongodb`里，我们可以为每一个`documents`增加一个`transactions`的字段，用以表示正在使用该文档的事务。

但实际上，我们没必要去维护更新版本号。只需要利用MongoDB的原子操作`$SET`为每次需要使用的数据加上事务id即可。这样其他需要读或写的操作一旦判断到该`document`存在事务id，就能根据策略判断是否进行。

这种业务代码层面实现的2pc跟mysql内置的mvcc还是有一定的差距，而且存在一定的繁复性。