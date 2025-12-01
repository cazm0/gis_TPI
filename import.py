import subprocess
import sys
import os
import glob
import shutil
import webbrowser

# --- CONFIGURACIÓN ---
# Configuración para PostGIS en Docker (docker-compose.yml)
DB_HOST = "localhost"
DB_PORT = "5433"  # Puerto del host (Docker mapea 5432 interno -> 5433 externo)
DB_NAME = "geoserver"  # Base de datos según docker-compose.yml
DB_USER = "postgres"
DB_PASSWORD = "postgres"  # Contraseña según docker-compose.yml
DB_SSLMODE = "disable"

INPUT_FILENAME = "GisTPI" 

# --- HERRAMIENTAS ---
def find_executable(name):
    """Busca herramientas como psql, pg_restore o ogr2ogr."""
    path = shutil.which(name)
    if path: return path
    
    common_paths = [
        r"C:\Program Files\PostgreSQL\*\bin",
        r"C:\Program Files (x86)\PostgreSQL\*\bin",
        r"C:\OSGeo4W\bin",
        r"C:\Program Files\QGIS*\bin"
    ]
    for pattern in common_paths:
        matches = glob.glob(os.path.join(pattern, name + ".exe"))
        matches.sort(reverse=True)
        if matches: return matches[0]
    return None

def launch_stackbuilder_from_error(stderr_output):
    """
    Intenta deducir dónde está PostgreSQL basándose en la ruta del error
    y lanza el Application Stack Builder.
    """
    print("\n🕵️ Intentando localizar el instalador de PostGIS...", flush=True)
    
    # El error suele ser algo como: "No such file... C:/Program Files/PostgreSQL/17/share/extension/postgis.control"
    # Buscamos la ruta base
    base_path = None
    if "PostgreSQL" in stderr_output:
        # Intentar extraer la ruta hasta la versión (ej: C:/Program Files/PostgreSQL/17)
        try:
            # Buscar el inicio de la ruta (C:/...)
            start_idx = stderr_output.find("C:/") 
            if start_idx == -1: start_idx = stderr_output.find("C:\\")
            
            if start_idx != -1:
                # Cortar hasta 'share'
                end_idx = stderr_output.find("share", start_idx)
                if end_idx != -1:
                    base_path = stderr_output[start_idx:end_idx].strip("/\\ ")
        except:
            pass

    stackbuilder_path = None
    
    # Si dedujimos la ruta del error
    if base_path:
        candidate = os.path.join(base_path, "bin", "stackbuilder.exe")
        if os.path.exists(candidate):
            stackbuilder_path = candidate
    
    # Si no, búsqueda bruta
    if not stackbuilder_path:
        candidates = glob.glob(r"C:\Program Files\PostgreSQL\*\bin\stackbuilder.exe")
        if candidates:
            stackbuilder_path = candidates[-1] # El último (versión más reciente)

    if stackbuilder_path and os.path.exists(stackbuilder_path):
        print(f"✅ Instalador encontrado en: {stackbuilder_path}", flush=True)
        print("🚀 Lanzando Application Stack Builder...", flush=True)
        print("⚠️  ACCIÓN REQUERIDA POR EL USUARIO:", flush=True)
        print("   1. Se abrirá una ventana. Selecciona tu PostgreSQL en el menú desplegable.")
        print("   2. Dale a 'Next' hasta llegar a la lista de aplicaciones.")
        print("   3. Abre la rama 'Spatial Extensions'.")
        print("   4. Marca la casilla 'PostGIS X.X Bundle'.")
        print("   5. Sigue los pasos para instalar. Cuando termine, vuelve aquí y ejecuta este script de nuevo.")
        
        try:
            subprocess.Popen([stackbuilder_path])
            return True
        except Exception as e:
            print(f"❌ Error al intentar abrirlo: {e}")
    else:
        print("❌ No pude encontrar 'stackbuilder.exe'.", flush=True)
        print("🌐 Abriendo página de descarga en el navegador...", flush=True)
        webbrowser.open("https://www.postgis.net/documentation/getting_started/install_windows/")
    
    return False

def force_enable_postgis():
    """Intenta activar la extensión PostGIS manualmente antes de importar."""
    print("\n--- PASO 1: ACTIVANDO POSTGIS EN LA BASE DE DATOS ---", flush=True)
    tool = find_executable("psql")
    if not tool:
        print("❌ No encuentro psql. No puedo activar PostGIS.", file=sys.stderr)
        return False

    env = os.environ.copy()
    env["PGPASSWORD"] = DB_PASSWORD

    commands = [
        "CREATE EXTENSION IF NOT EXISTS postgis CASCADE;",
        "CREATE EXTENSION IF NOT EXISTS postgis_topology;"
    ]

    for sql in commands:
        cmd = [tool, "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME, "-c", sql]
        try:
            result = subprocess.run(cmd, env=env, capture_output=True, text=True)
            if result.returncode == 0:
                print(f"✅ Ejecutado: {sql}", flush=True)
            else:
                # Si falla, analizamos por qué
                err_msg = result.stderr
                if "No such file or directory" in err_msg and "postgis.control" in err_msg:
                    print(f"\n🛑 FALTA POSTGIS EN EL SISTEMA.", file=sys.stderr)
                    launch_stackbuilder_from_error(err_msg)
                    sys.exit(1) # Detenemos el script para que el usuario instale
                else:
                     print(f"⚠️ Error SQL (ignorable si ya existe): {err_msg.strip()}", file=sys.stderr)

        except Exception as e:
            print(f"❌ Error intentando activar PostGIS: {e}")

def detect_file_type(filepath):
    try:
        with open(filepath, 'rb') as f:
            header = f.read(15)
        if header.startswith(b'PGDMP'): return "PG_DUMP_BINARY"
        elif b'SQLite format 3' in header: return "GEOPACKAGE"
        else:
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    start = f.read(100).upper()
                    if "CREATE" in start or "SET" in start or "--" in start: return "SQL_SCRIPT"
            except: pass
    except: pass
    return "UNKNOWN"

def import_with_pg_restore(filepath):
    print("\n--- PASO 2: IMPORTANDO ARCHIVO BINARIO (pg_restore) ---", flush=True)
    
    # PRIMERO ACTIVAMOS POSTGIS
    force_enable_postgis()

    tool = find_executable("pg_restore")
    if not tool:
        print("❌ ERROR: No encuentro 'pg_restore'.", file=sys.stderr)
        return

    env = os.environ.copy()
    env["PGPASSWORD"] = DB_PASSWORD

    cmd = [
        tool,
        "-h", DB_HOST,
        "-p", DB_PORT,
        "-U", DB_USER,
        "-d", DB_NAME,
        "-v",          # Verbose
        "-c",          # Clean (Borra tablas antes de crear)
        "--if-exists", # No da error si la tabla no existe al borrar
        "--no-owner",  # Ignora dueños originales
        "--no-acl",    # Ignora permisos originales
        filepath
    ]
    
    print(f"Ejecutando restauración...", flush=True)
    try:
        subprocess.run(cmd, env=env, check=False) 
        print("\n🎉 Proceso finalizado. Ignora advertencias menores si las tablas se crearon.", flush=True)
    except Exception as e:
        print(f"\n⚠️ Error ejecutando pg_restore: {e}", flush=True)

def import_with_psql(filepath):
    print("\n--- PASO 2: IMPORTANDO SCRIPT SQL ---", flush=True)
    force_enable_postgis() 

    tool = find_executable("psql")
    if not tool:
        print("❌ ERROR: No encuentro 'psql'.", file=sys.stderr)
        return

    env = os.environ.copy()
    env["PGPASSWORD"] = DB_PASSWORD

    cmd = [tool, "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME, "-f", filepath]
    
    try:
        subprocess.run(cmd, env=env, check=True)
        print("\n🎉 Importación SQL finalizada.", flush=True)
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error ejecutando psql (Código {e.returncode}).", file=sys.stderr)

def import_with_ogr2ogr(filepath):
    print("\n--- IMPORTANDO CON OGR2OGR ---", flush=True)
    tool = find_executable("ogr2ogr")
    dsn = f"PG:host={DB_HOST} port={DB_PORT} dbname={DB_NAME} user={DB_USER} password={DB_PASSWORD}"
    cmd = [tool, "-f", "PostgreSQL", dsn, filepath, "-overwrite", "-nln", "GisTPI_import"]
    subprocess.run(cmd)

# --- EJECUCIÓN ---
def resolve_input_file(filename_raw):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(script_dir, filename_raw)
    if os.path.isfile(path): return path
    return None

if __name__ == "__main__":
    print("--- INICIANDO PROCESO DE RECUPERACIÓN ---", flush=True)
    
    input_path = resolve_input_file(INPUT_FILENAME)
    
    if not input_path:
        print(f"❌ No encuentro el archivo '{INPUT_FILENAME}'.", file=sys.stderr)
        sys.exit(1)
        
    file_type = detect_file_type(input_path)
    print(f"Tipo de archivo: {file_type}", flush=True)
    
    if file_type == "PG_DUMP_BINARY":
        import_with_pg_restore(input_path)
    elif file_type == "SQL_SCRIPT":
        import_with_psql(input_path)
    elif file_type == "GEOPACKAGE":
        import_with_ogr2ogr(input_path)
    else:
        print("⚠️ Formato desconocido, probando pg_restore...", flush=True)
        import_with_pg_restore(input_path)