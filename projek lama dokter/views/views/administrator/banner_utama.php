<div class="content-wrapper">
    <section class="content-header">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="card card-info">
                        <div class="card-header">
                            <h3 class="card-title">DATA BANNER UTAMA</h3>
                            <div class="card-tools">
                                <a href="<?= site_url('Administrator/tambah_banner_utama') ?>" class="btn btn-tool">
                                    <i class="fas fa-chalkboard-teacher"></i>
                                </a>

                            </div>
                        </div>
                        <div class="card-body">
                            <table class="table table-stripped">
                                <thead>
                                    <tr>
                                        <th>No.</th>
                                        <th>Gambar Banner</th>
                                        <th>Judul Banner</th>
                                        <th>Kategori Banner</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php
                                    $nomor = 1;
                                    foreach ($banner as $b) { ?>
                                        <tr>
                                            <td><?= $nomor; ?></td>
                                            <td width="250px"><img src="<?= base_url() ?>assets/img/banner/<?= $b->foto ?>" width="100%" alt="Banner"></td>
                                            <td><?= $b->judul_banner; ?></td>
                                            <td>
                                                <?php if ($b->log_banner == 1) {
                                                    echo "Banner Utama";
                                                } else {
                                                    echo "";
                                                } ?>
                                            </td>
                                            <td>
                                                <a href="<?= site_url('Administrator/ubahBannerUtama/' . $b->id_banner) ?>" class="btn btn-info"><i class="fas fa-recycle"></i></a>
                                            </td>
                                        </tr>
                                    <?php
                                        $nomor++;
                                    }
                                    ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>