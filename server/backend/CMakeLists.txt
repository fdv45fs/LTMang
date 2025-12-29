cmake_minimum_required(VERSION 3.10)
project(FlightServer C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

# Include directories
include_directories(${CMAKE_SOURCE_DIR}/libs/cJSON)
include_directories(${CMAKE_SOURCE_DIR}/libs/mongoose)
include_directories(${CMAKE_SOURCE_DIR}/common)
include_directories(${CMAKE_SOURCE_DIR}/messages)
include_directories(${CMAKE_SOURCE_DIR}/dto)

# Source files
set(SOURCES
    main.c
    ${CMAKE_SOURCE_DIR}/libs/cJSON/cJSON.c
    ${CMAKE_SOURCE_DIR}/libs/mongoose/mongoose.c
)

# Create executable
add_executable(server ${SOURCES})

# Link libraries (pthread for threading)
target_link_libraries(server pthread)

# Define MG_ENABLE_LINES for better Mongoose debugging
target_compile_definitions(server PRIVATE MG_ENABLE_LINES=1)
