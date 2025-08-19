#!/usr/bin/env python3

import os
from pathlib import Path
from gitignore_parser import parse_gitignore


def read_title(path):
    '''
    Reads the title in the frontmatter of the markdown file `path` 
    '''
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


def add_link_to_parent_index(folder, title):
    '''
    Append a link to a folder's parent index, if it exists
    '''
    parent_index = os.path.join(folder, '../index.md')
    if os.path.isfile(parent_index):
        with open(parent_index, 'a') as index_fd:
            root_parts = os.path.normpath(folder).split(os.path.sep)
            print(f'- [{title}](./{root_parts[len(root_parts) - 1]})', file=index_fd)
            return 1
    return 0

matches = parse_gitignore('.indexignore')

index_count = 0

# For the contents of each folder ..
for (folder, _, files) in os.walk('.'):
    # .. filter using `.indexignore`.
    paths = []
    for file in files:
        path = os.path.join(folder, file)
        if not matches(path):
            paths.append(path)
    # If there are items to link ..
    if paths:
        target_index = os.path.join(folder, 'index.md')
        # .. append a link to the parent index ..
        index_count += add_link_to_parent_index(folder, read_title(target_index))
        # .. and create index links for each item
        with open(target_index, 'a') as index_fd:
            for path in paths:
                print(f'- [{read_title(path)}](./{Path(path).stem})', file=index_fd)
        index_count += len(paths)

print(f'Generated {index_count} index links.')
