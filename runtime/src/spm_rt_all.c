/*
 * Unity build (Software implementation › 11c): one translation unit with every layer, in layer order.
 * spm_rt_main.c adds main(); the Unity tests include this file the same way.
 */
#include "base/base_inc.c"
#include "os/os_inc.c"
#include "data/data_inc.c"
#include "data/prog.c"
#include "drv/card_sim.c"
#include "feat/feat_inc.c"
#include "feat/machine.c"
#include "feat/comm.c"
