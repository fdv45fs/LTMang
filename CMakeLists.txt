cmake_minimum_required(VERSION 3.10)
project(FlightBookingApp C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

# Add subdirectories
add_subdirectory(server/backend)
add_subdirectory(client/backend)
