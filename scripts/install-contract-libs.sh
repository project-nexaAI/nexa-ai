#!/bin/sh
# Jalankan di: ROOT
# Memasang dependensi Foundry (tidak di-commit) ke contracts/lib dengan versi yang dipin.
set -e
cd "$(dirname "$0")/../contracts"
mkdir -p lib
[ -d lib/forge-std ] || git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
[ -d lib/openzeppelin-contracts ] || git clone --depth 1 --branch v5.1.0 https://github.com/OpenZeppelin/openzeppelin-contracts lib/openzeppelin-contracts
rm -rf lib/forge-std/.git lib/openzeppelin-contracts/.git
