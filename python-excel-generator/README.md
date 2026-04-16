# Excel 测试数据生成工具

快速生成 Excel 测试数据，支持添加表头、内容和随机模拟数据。

## 安装

### 使用 uv（推荐）

```bash
uv sync
```

### 使用 pip

```bash
pip install -r requirements.txt
```

## 使用方法

### 生成带随机数据的 Excel

```bash
python -m src.main generate <文件路径> --count <行数>
```

**示例**：
```bash
python -m src.main generate test.xlsx --count 100
```

生成包含以下字段的 Excel 文件：
- 姓名 (name)
- 年龄 (age)
- 邮箱 (email)
- 电话 (phone)
- 城市 (city)

---

### 添加自定义表头

```bash
python -m src.main add-header <文件路径> --headers "<表头1>,<表头2>,..."
```

**示例**：
```bash
python -m src.main add-header test.xlsx --headers "学校,年龄,姓名,班级"
```

---

### 添加内容（指定数据类型）

```bash
python -m src.main add-content <文件路径> --rows <行数> --template "<列名>:<类型>,..."
```

**示例**：
```bash
python -m src.main add-content test.xlsx --rows 50 --template "姓名:name,邮箱:email,城市:city"
```

---

## 支持的数据类型

| 类型 | 说明 | 示例 |
|------|------|------|
| name | 随机姓名 | 张伟 |
| age | 随机年龄 | 25 |
| email | 随机邮箱 | zhang@example.com |
| phone | 随机电话 | 13812341234 |
| city | 随机城市 | 北京市 |
| address | 随机地址 | 北京市朝阳区... |
| date | 随机日期 | 2024-01-15 |
| company | 随机公司 | 百度有限公司 |
| job | 随机职业 | 软件工程师 |

---

## 命令速查

```bash
# 生成 10 行随机数据
python -m src.main generate test.xlsx --count 10

# 添加自定义表头
python -m src.main add-header new.xlsx --headers "姓名,电话,地址"

# 添加 100 行内容
python -m src.main add-content existing.xlsx --rows 100

# 指定数据类型添加内容
python -m src.main add-content data.xlsx --rows 50 --template "姓名:name,邮箱:email,公司:company"
```
