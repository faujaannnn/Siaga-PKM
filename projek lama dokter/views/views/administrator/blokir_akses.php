    <!-- Content Wrapper. Contains page content -->
    <div class="content-wrapper">

        <section class="content-header">
            <div class="container-fluid">
                <div class="row mb-2">
                    <div class="col-sm-6">
                        <h1>404 Error Page</h1>
                    </div>
                    <div class="col-sm-6">

                        <ol class="breadcrumb float-sm-right">
                            <li class="breadcrumb-item"><a href="<?= site_url('Administrator') ?>"><i class="fas fa-tachometer-alt"></i> Home</a></li>
                            <li class="breadcrumb-item"><a href="#">Kesalahan</a></li>
                            <li class="breadcrumb-item active">error 404</li>
                        </ol>
                    </div>
                </div>
            </div><!-- /.container-fluid -->
        </section>

        <!-- Main content -->
        <section class="content">

            <div class="error-page">
                <h2 class="headline text-red">404</h2>

                <div class="error-content">
                    <h3><i class="fa fa-warning text-red"></i> Oops! Kesalahan akses form</h3>

                    <p>
                        Halaman ini tidak bisa diakses, Silahkan hubungi administrator untuk info lebih lanjut.
                        Silakan tekan <a href="<?php echo site_url('Administrator') ?>">Kembali ke dashboard</a> untuk mengakses form lain.
                    </p>

                    <form class="search-form">
                        <div class="input-group">
                            <input type="text" name="search" class="form-control" placeholder="Search">

                            <div class="input-group-btn">
                                <button type="submit" name="submit" class="btn btn-danger btn-flat"><i class="fa fa-search"></i>
                                </button>
                            </div>
                        </div>
                        <!-- /.input-group -->
                    </form>
                </div>
            </div>
            <!-- /.error-page -->

        </section>
        <!-- /.content -->