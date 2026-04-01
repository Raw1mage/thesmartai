cmake_minimum_required(VERSION 3.16)
project(claude_provider VERSION 0.1.0 LANGUAGES C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
add_compile_options(-Wall -Wextra -Werror -Wpedantic)
set(CMAKE_C_VISIBILITY_PRESET hidden)

set(SOURCES
    src/provider.c
    src/originator.c
    src/storage.c
    src/auth.c
    src/stream.c
    src/transform.c
    src/transport.c
)

add_library(claude_provider SHARED ${SOURCES})
target_include_directories(claude_provider PUBLIC include)
set_target_properties(claude_provider PROPERTIES
    PREFIX ""
    OUTPUT_NAME "claude_provider"
    VERSION ${PROJECT_VERSION}
    SOVERSION 1
)

add_executable(claude-provider src/main.c)
target_include_directories(claude-provider PRIVATE include)
target_link_libraries(claude-provider PRIVATE claude_provider)

include(GNUInstallDirs)
install(TARGETS claude_provider claude-provider
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)
install(FILES include/claude_provider.h DESTINATION ${CMAKE_INSTALL_INCLUDEDIR})
