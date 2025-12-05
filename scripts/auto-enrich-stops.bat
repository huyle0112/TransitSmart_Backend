@echo off
REM Auto-enrich all stops script
REM This will run the enrichment script multiple times until all stops are geocoded

echo ========================================
echo   Hanoi Transit - Auto Stop Enrichment
echo ========================================
echo.
echo This script will automatically enrich ALL stops with proper names
echo Format: "Ben [Dia danh dac trung]"
echo.
echo Press Ctrl+C to stop at any time
echo.
pause

cd /d "%~dp0.."

:loop
echo.
echo ========================================
echo Running enrichment pass...
echo ========================================
echo.

node scripts\enrich-stop-names.js

if errorlevel 1 (
    echo.
    echo ERROR: Enrichment failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Enrichment pass completed!
echo ========================================
echo.
echo Waiting 5 seconds before next pass...
timeout /t 5 /nobreak > nul

REM Check if there are more stops to process
findstr /C:"STOP_" data\gtfs\stops-enriched.txt > nul
if %errorlevel% equ 0 (
    echo Still have unenriched stops, continuing...
    goto loop
)

echo.
echo ========================================
echo All stops enriched!
echo ========================================
echo.
echo Now copying enriched stops to production...

copy data\gtfs\stops.txt data\gtfs\stops-original-backup.txt
copy data\gtfs\stops-enriched.txt data\gtfs\stops.txt

echo.
echo DONE! Restart your server to see enriched stop names.
echo.
pause

