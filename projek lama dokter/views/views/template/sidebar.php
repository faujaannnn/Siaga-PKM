<!-- Sidebar Menu -->
<nav class="mt-2">
    <ul class="nav nav-pills nav-sidebar flex-column" data-widget="treeview" role="menu" data-accordion="false">
        <!-- Add icons to the links using the .nav-icon class
             with font-awesome or any other icon font library -->
        <li class="nav-item has-treeview menu-open">


            <a href="<?= site_url('Administrator') ?>" class="nav-link active" style="background-color:#17a2b8;">

                <i class="nav-icon fas fa-tachometer-alt"></i>
                <p>
                    Dashboard
                    <!-- <i class="right fas fa-angle-left"></i> -->
                </p>
            </a>

        </li>
        <?php if ($this->session->userdata('id_admin') == 1) { ?>
            <li class="nav-item">
                <a href="#" class="nav-link">
                    <i class="nav-icon fas fa-cogs"></i>
                    <p>
                        Setting
                        <i class="fas fa-angle-left right"></i>
                        <span class="badge badge-info right">1</span>
                    </p>
                </a>
                <ul class="nav nav-treeview">
                    <li class="nav-item">
                        <a href="<?= site_url('Administrator/kontrol_panel') ?>" class="nav-link">
                            <i class="fas fa-cog nav-icon"></i>
                            <p>Kontrol Panel</p>
                        </a>
                    </li>

                </ul>
            </li>
        <?php } ?>
        <li class="nav-item">
            <a href="#" class="nav-link">
                <i class="nav-icon fas fa-id-card-alt"></i>
                <p>
                    Banner
                    <i class="fas fa-angle-left right"></i>
                    <span class="right badge badge-info">2</span>
                </p>
            </a>
            <ul class="nav nav-treeview">
                <li class="nav-item">
                    <a href="<?= site_url('Administrator/banner_utama') ?>" class="nav-link">
                        <i class="far fa-image nav-icon"></i>
                        <p>Banner Utama</p>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="<?= site_url('Administrator/blokir_akses') ?>" class="nav-link">
                        <i class="far fa-image nav-icon"></i>
                        <p>Banner Footer</p>
                    </a>
                </li>

            </ul>
        </li>
        <li class="nav-item">
            <a href="#" class="nav-link">
                <i class="nav-icon fas fa-bullhorn"></i>
                <p>
                    Informasi
                    <i class="fas fa-angle-left right"></i>
                    <span class="right badge badge-info">
                        4
                    </span>
                </p>
            </a>
            <ul class="nav nav-treeview">
                <li class="nav-item">
                    <a href="<?= site_url('Administrator/berita') ?>" class="nav-link">
                        <i class="fas fa-file-signature nav-icon"></i>
                        <p>Kontrol Berita</p>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="<?= site_url('Administrator/pengumuman') ?>" class="nav-link">
                        <i class="far fa-newspaper nav-icon"></i>
                        <p>Kontrol Pengumuman</p>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="<?= site_url('Administrator/tips_bencana') ?>" class="nav-link">
                        <i class="far fa-newspaper nav-icon"></i>
                        <p>Kontrol Tips Bencana</p>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="<?= site_url('Administrator/info_pelatihan') ?>" class="nav-link">
                        <i class="far fa-newspaper nav-icon"></i>
                        <p>Kontrol Pelatihan</p>
                    </a>
                </li>
            </ul>
        </li>


        <li class="nav-item">
            <a href="#" class="nav-link">
                <i class="nav-icon fas fa-images"></i>
                <p>
                    Galeri
                    <i class="fas fa-angle-left right"></i>
                    <span class="badge badge-info right">2</span>
                </p>
            </a>
            <ul class="nav nav-treeview">
                <li class="nav-item">
                    <a href="<?= site_url('Administrator/galeri') ?>" class="nav-link">
                        <i class="fa fa-medkit nav-icon"></i>
                        <p>Foto</p>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="<?= site_url('Administrator/blokir_akses') ?>" class="nav-link">
                        <i class="fa fa-medkit nav-icon"></i>
                        <p>Video</p>
                    </a>
                </li>

            </ul>
        </li>
        <li class="nav-item">
            <a href="#" class="nav-link">
                <i class="nav-icon fas fa-newspaper"></i>
                <p>
                    Kontrol Literasi
                    <i class="fas fa-angle-left right"></i>
                    <span class="right badge badge-info">
                        3
                    </span>
                </p>
            </a>
            <ul class="nav nav-treeview">
                <li class="nav-item">
                    <a href="<?= site_url('Administrator/literasi_peraturan') ?>" class="nav-link">
                        <i class="fas fa-balance-scale nav-icon"></i>
                        <p>Peraturan</p>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="<?= site_url('Administrator/literasi_materi') ?>" class="nav-link">
                        <i class="fas fa-file-pdf nav-icon"></i>
                        <p>Materi</p>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="<?= site_url('Administrator/literasi_video') ?>" class="nav-link">
                        <i class="fas fa-video nav-icon"></i>
                        <p>Video</p>
                    </a>
                </li>
            </ul>
        </li>
        <li class="nav-item">
            <a href="#" class="nav-link">
                <i class="nav-icon fas fa-book-open"></i>
                <p>
                    Sosial
                    <i class="fas fa-angle-left right"></i>
                    <span class="badge badge-info right">3</span>
                </p>
            </a>
            <ul class="nav nav-treeview">
                <li class="nav-item">
                    <a href="<?= site_url('Administrator/blokir_akses') ?>" class="nav-link">
                        <i class="fa fa-book nav-icon"></i>
                        <p>Aduan</p>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="<?= site_url('Administrator/blokir_akses') ?>" class="nav-link">
                        <i class="fa fa-book nav-icon"></i>
                        <p>Saran</p>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="<?= site_url('Administrator/blokir_akses') ?>" class="nav-link">
                        <i class="fa fa-book nav-icon"></i>
                        <p>Statistik</p>
                    </a>
                </li>
            </ul>
        </li>
    </ul>
</nav>
<!-- /.sidebar-menu -->