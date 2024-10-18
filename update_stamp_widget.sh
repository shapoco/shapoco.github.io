#!/bin/bash

set -eux

WORK_DIR=$(pwd)
TMP_DIR="${WORK_DIR}/.tmp"
OUT_DIR="${WORK_DIR}/docs"
REPO_NAME="stamps-php"
VERSION="v1.0"

./check_repos_is_clean.sh

mkdir -p "${TMP_DIR}"
pushd "${TMP_DIR}"
  if [ -e "${REPO_NAME}" ]; then
    git pull
  else
    git clone "git@github.com:shapoco/${REPO_NAME}.git"
  fi
popd

cp "${TMP_DIR}/stamps-php/stamp/${VERSION}/widget.js" "${OUT_DIR}/js/stamp/${VERSION}/."

url_postfix=$(date +"%Y%m%d%H%M%S")

set +x
for path in $(find "${OUT_DIR}" -type f -name "*.html"); do
  if grep -e "/stamp/v[0-9]\+\.[0-9]\+/widget\.js" --quiet "${path}"; then
    echo "Updating: '${path}'"
    sed -i "${path}" -e "s:/stamp/v[0-9]\+\.[0-9]\+/widget\.js\(\?[0-9]\+\):/stamp/${VERSION}/widget\.js?${url_postfix}:g"
    git add "${path}"
  fi
done
set -x

git status
git commit -m "Update stamp widget (url_postfix=${url_postfix})"
git push

