cmake_minimum_required(VERSION 3.10)
project(FlightServer C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

# Include directories
include_directories(${CMAKE_SOURCE_DIR}/libs/cJSON)

# Source files
set(SOURCES
    main.c
    ${CMAKE_SOURCE_DIR}/libs/cJSON/cJSON.c
)

# Create executable
add_executable(server ${SOURCES})

# Link libraries (pthread for threading)
target_link_libraries(server pthread)


