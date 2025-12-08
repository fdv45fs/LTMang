import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect
from sqlalchemy.types import Integer, String, Boolean, DateTime, Date, Numeric, Text, Float, TIMESTAMP

# 1. Load Config
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("Error: DATABASE_URL not found in .env")
    exit(1)

# 2. Connect DB
engine = create_engine(DATABASE_URL)
inspector = inspect(engine)

# 3. Helper to map types
def get_c_field_def(col_name, col_type):
    """
    Returns a string line for a C struct field definition.
    e.g. "    int id;" or "    char username[256];"
    """
    # Integer
    if isinstance(col_type, Integer):
        return f"    int {col_name};"
    
    # Boolean
    elif isinstance(col_type, Boolean):
        return f"    bool {col_name};"
    
    # Floating point
    elif isinstance(col_type, (Numeric, Float)):
        return f"    double {col_name};"
    
    # Strings & Text
    elif isinstance(col_type, (String, Text)):
        length = getattr(col_type, 'length', None)
        if length:
            # Add +1 for null terminator
            return f"    char {col_name}[{length + 1}];"
        else:
            # Default for TEXT or unbounded VARCHAR
            return f"    char {col_name}[1024];"
            
    # Date/Time -> String representation
    elif isinstance(col_type, (DateTime, Date, TIMESTAMP)):
        return f"    char {col_name}[32]; // ISO8601 Format"
        
    # Fallback
    else:
        return f"    void* {col_name}; // Unknown type: {col_type}"

def generate_header_file(table_name, columns):
    struct_name = f"{table_name}DTO"
    header_guard = f"{table_name.upper()}_DTO_H"
    
    lines = []
    lines.append(f"#ifndef {header_guard}")
    lines.append(f"#define {header_guard}")
    lines.append("")
    lines.append("#include <stdbool.h>")
    lines.append("#include <stdint.h>")
    lines.append("")
    lines.append(f"// DTO for table: {table_name}")
    lines.append(f"typedef struct {{")
    
    for col in columns:
        field_def = get_c_field_def(col['name'], col['type'])
        lines.append(field_def)
        
    lines.append(f"}} {struct_name};")
    lines.append("")
    lines.append(f"#endif // {header_guard}")
    
    return "\n".join(lines)

def main():
    output_dir = "dto"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    print(f"Connecting to database...")
    tables = inspector.get_table_names()
    print(f"Found tables: {tables}")
    
    for table in tables:
        columns = inspector.get_columns(table)
        content = generate_header_file(table, columns)
        
        file_path = os.path.join(output_dir, f"{table}.h")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
            
        print(f"-> Generated: {file_path}")

if __name__ == "__main__":
    main()
