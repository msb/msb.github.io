#!/usr/bin/env python3

import os
from pathlib import Path
from gitignore_parser import parse_gitignore

matches = parse_gitignore('.indexignore')

def read_title(path):
    frontmatter = False
    title = None
    with open(path, 'r') as file_fd:
        for raw_line in file_fd:
            line = raw_line.rstrip()
            if line == '---':
                if frontmatter:
                    break
                frontmatter = True
            elif frontmatter and line.startswith('title:'):
                title = line[6:]
                break
    if not title:
        raise Exception(f"couldn't find title: {path}")
    return title.strip()

for (root, _, files) in os.walk('.'):
    paths = []
    for file in files:
        path = os.path.join(root, file)
        if not matches(path):
            paths.append(path)
    if paths:
        target_index = os.path.join(root, 'index.md')
        title = read_title(target_index)
        root_parts = os.path.normpath(root).split(os.path.sep)
        with open(os.path.join(root, '../index.md'), 'a') as index_fd:
            print(f'- [{title.strip()}](./{root_parts[len(root_parts) - 1]})', file=index_fd)
        with open(target_index, 'a') as index_fd:
            for path in paths:
                title = read_title(path)
                print(f'- [{title}](./{Path(path).stem})', file=index_fd)
