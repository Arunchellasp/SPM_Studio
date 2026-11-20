cmake_minimum_required(VERSION 3.20)
project(spm_rt VERSION 0.1.0 LANGUAGES C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

# Unity build: spm_rt_main.c includes every layer (see mind_map section 11c)
add_executable(spm_rt src/spm_rt_main.c)
target_include_directories(spm_rt PRIVATE include)
target_compile_definitions(spm_rt PRIVATE SPM_RT_VERSION="${PROJECT_VERSION}")

if(MSVC)
  target_compile_options(spm_rt PRIVATE /W4 /WX)
else()
  target_compile_options(spm_rt PRIVATE -Wall -Wextra -Werror)
endif()
