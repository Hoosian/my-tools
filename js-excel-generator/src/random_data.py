"""随机数据生成模块，提供各种类型的测试数据生成功能。"""

from faker import Faker

fake = Faker('zh_CN')


def generate_name():
    """生成随机姓名。"""
    return fake.name()


def generate_age(min_age=18, max_age=60):
    """生成随机年龄。"""
    return fake.random_int(min=min_age, max=max_age)


def generate_email():
    """生成随机邮箱。"""
    return fake.email()


def generate_phone():
    """生成随机电话号码。"""
    return fake.phone_number()


def generate_city():
    """生成随机城市。"""
    return fake.city()


def generate_address():
    """生成随机地址。"""
    return fake.address()


def generate_date(start_date='-1y', end_date='today'):
    """生成随机日期。"""
    return fake.date_between(start_date=start_date, end_date=end_date).strftime('%Y-%m-%d')


def generate_company():
    """生成随机公司名。"""
    return fake.company()


def generate_job():
    """生成随机职业。"""
    return fake.job()


DATA_GENERATORS = {
    'name': generate_name,
    'age': generate_age,
    'email': generate_email,
    'phone': generate_phone,
    'city': generate_city,
    'address': generate_address,
    'date': generate_date,
    'company': generate_company,
    'job': generate_job,
}


def generate(field_type: str):
    """根据类型生成随机数据"""
    generator = DATA_GENERATORS.get(field_type, generate_name)
    return generator()
