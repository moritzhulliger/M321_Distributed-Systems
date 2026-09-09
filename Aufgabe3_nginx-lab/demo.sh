#!/bin/bash
for i in $(seq 1 15); do
  curl -s -H "Host: service-counter.local" http://localhost/increment
  echo
done
