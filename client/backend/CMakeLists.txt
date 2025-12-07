cmake_minimum_required(VERSION 3.10)
project(FlightClient C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

# Include directories
include_directories(${CMAKE_SOURCE_DIR}/libs/mongoose)
include_directories(${CMAKE_SOURCE_DIR}/libs/cJSON)

# Source files
set(SOURCES
    main.c
    ${CMAKE_SOURCE_DIR}/libs/mongoose/mongoose.c
    ${CMAKE_SOURCE_DIR}/libs/cJSON/cJSON.c
)

# Create executable
add_executable(client ${SOURCES})

# Link libraries
target_link_libraries(client pthread)

# Define MG_ENABLE_LINES for better Mongoose debugging
target_compile_definitions(client PRIVATE MG_ENABLE_LINES=1)


