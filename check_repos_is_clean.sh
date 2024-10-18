#!/bin/bash

if git diff --quiet; then
  if git diff --cached --quiet; then
    exit 0
  else
    echo "*ERROR: There are staged changes in this repository."
    exit 1
  fi
else
  echo "*ERROR: There are unstaged changes in this repository."
  exit 1
fi

