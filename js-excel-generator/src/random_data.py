from faker import Faker

fake = Faker('zh_CN')


def generate_name():
    return fake.name()


def generate_age(min_age=18, max_age=60):
    return fake.random_int(min=min_age, max=max_age)


def generate_email():
    return fake.email()


def generate_phone():
    return fake.phone_number()


def generate_city():
    return fake.city()


def generate_address():
    return fake.address()


def generate_date(start_date='-1y', end_date='today'):
    return fake.date_between(start_date=start_date, end_date=end_date).strftime('%Y-%m-%d')


def generate_company():
    return fake.company()


def generate_job():
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
