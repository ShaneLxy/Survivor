@echo off
chcp 65001 > nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; & '%~dp0migrate-claude-3p.ps1'"
pause
