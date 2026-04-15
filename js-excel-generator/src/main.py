"""Excel 测试数据生成工具 CLI 入口。"""

import argparse
from .generator import add_headers, add_content, generate_excel


DEFAULT_HEADERS = ['姓名', '年龄', '邮箱', '电话', '城市']
DEFAULT_SCHEMA = {
    '姓名': 'name',
    '年龄': 'age',
    '邮箱': 'email',
    '电话': 'phone',
    '城市': 'city',
}


def cmd_add_header(args):
    """处理 add-header 命令。"""
    headers = [h.strip() for h in args.headers.split(',')]
    add_headers(args.file, headers)
    print(f'已添加表头到 {args.file}: {headers}')


def cmd_add_content(args):
    """处理 add-content 命令。"""
    schema = {}
    if args.template:
        for item in args.template.split(','):
            parts = item.split(':')
            if len(parts) == 2:
                header, data_type = parts
                schema[header.strip()] = data_type.strip()
            else:
                schema[item.strip()] = '_fixed_'

    if not schema:
        schema = DEFAULT_SCHEMA

    add_content(args.file, args.rows, schema)
    print(f'已添加 {args.rows} 行数据到 {args.file}')


def cmd_generate(args):
    """处理 generate 命令。"""
    headers = DEFAULT_HEADERS if not args.headers else [h.strip() for h in args.headers.split(',')]
    schema = DEFAULT_SCHEMA

    generate_excel(args.file, args.count, headers, schema)
    print(f'已生成 {args.file}，包含表头和 {args.count} 行随机数据')


def main():
    """CLI 主入口。"""
    parser = argparse.ArgumentParser(description='Excel 测试数据生成工具')
    subparsers = parser.add_subparsers(dest='command', help='子命令')

    # add-header 命令
    parser_add_header = subparsers.add_parser('add-header', help='添加表头')
    parser_add_header.add_argument('file', help='Excel 文件路径')
    parser_add_header.add_argument('--headers', default='姓名,年龄,邮箱,电话,城市',
                                   help='表头，逗号分隔')
    parser_add_header.set_defaults(func=cmd_add_header)

    # add-content 命令
    parser_add_content = subparsers.add_parser('add-content', help='添加内容')
    parser_add_content.add_argument('file', help='Excel 文件路径')
    parser_add_content.add_argument('--rows', type=int, default=10, help='行数')
    parser_add_content.add_argument('--template',
                                   help='数据模板，格式: 列名:类型, 例如: 姓名:name,年龄:age')
    parser_add_content.set_defaults(func=cmd_add_content)

    # generate 命令
    parser_generate = subparsers.add_parser('generate', help='生成完整 Excel')
    parser_generate.add_argument('file', help='Excel 文件路径')
    parser_generate.add_argument('--count', type=int, default=10, help='数据行数')
    parser_generate.add_argument('--headers', help='表头，逗号分隔')
    parser_generate.set_defaults(func=cmd_generate)

    args = parser.parse_args()

    if hasattr(args, 'func'):
        args.func(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
